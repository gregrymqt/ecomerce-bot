package ml

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"ecommercebot/goworker/internal/redis"
	"ecommercebot/goworker/internal/streams"

	redisPkg "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type MLWorker struct {
	sidecarURL string
	httpClient *http.Client
	redisCli   *redis.Client
	publisher  *streams.Publisher
	logger     *zap.Logger
}

func NewMLWorker(
	sidecarURL string,
	redisCli *redis.Client,
	publisher *streams.Publisher,
	logger *zap.Logger,
) *MLWorker {
	return &MLWorker{
		sidecarURL: sidecarURL,
		httpClient: &http.Client{Timeout: 90 * time.Second},
		redisCli:   redisCli,
		publisher:  publisher,
		logger:     logger,
	}
}

func (w *MLWorker) ProcessMessage(ctx context.Context, msg redisPkg.XMessage) error {
	rawPayload, ok := msg.Values["payload"].(string)
	if !ok || rawPayload == "" {
		return fmt.Errorf("missing or empty payload in ml message id %s", msg.ID)
	}

	var payloadMap map[string]any
	if err := json.Unmarshal([]byte(rawPayload), &payloadMap); err != nil {
		w.logger.Error("Falha ao deserializar JSON de ML payload", zap.Error(err))
		return nil
	}

	tenantID, _ := payloadMap["tenantId"].(string)
	if tenantID == "" {
		if t, ok := payloadMap["tenant_id"].(string); ok {
			tenantID = t
		}
	}
	if tenantID == "" {
		w.logger.Warn("Mensagem de ML sem tenantId", zap.String("msgId", msg.ID))
		return nil
	}

	jobType, _ := payloadMap["jobType"].(string)
	if jobType == "" {
		jobType = "FULL_ANALYTICS"
	}

	// Idempotência
	messageID, _ := payloadMap["messageId"].(string)
	if messageID == "" {
		messageID = msg.ID
	}
	idempotencyKey := fmt.Sprintf("worker:idempotency:ml:%s:%s:%s", tenantID, jobType, messageID)
	if already, err := w.redisCli.IsAlreadyProcessed(ctx, idempotencyKey); err == nil && already {
		w.logger.Info("Job de ML já processado anteriormente (idempotência ativa)",
			zap.String("tenantId", tenantID),
			zap.String("jobType", jobType),
		)
		return nil
	}

	w.logger.Info("Processando job de ML via Sidecar",
		zap.String("tenantId", tenantID),
		zap.String("jobType", jobType),
	)

	// Chama o ML Sidecar via HTTP POST
	sidecarEndpoint := fmt.Sprintf("%s/api/ml/analyze", w.sidecarURL)
	reqBody, _ := json.Marshal(payloadMap)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sidecarEndpoint, bytes.NewReader(reqBody))
	if err != nil {
		w.publishFailure(tenantID, jobType, fmt.Sprintf("Failed to build sidecar request: %v", err))
		return nil
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := w.httpClient.Do(req)
	if err != nil {
		w.logger.Error("Erro ao comunicar com ML Sidecar", zap.Error(err))
		w.publishFailure(tenantID, jobType, fmt.Sprintf("ML Sidecar unreachable: %v", err))
		return nil
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		errMsg := fmt.Sprintf("ML Sidecar status %d, body: %s", resp.StatusCode, string(respBody))
		w.logger.Error("ML Sidecar retornou erro", zap.String("error", errMsg))
		w.publishFailure(tenantID, jobType, errMsg)
		return nil
	}

	var resultMap map[string]any
	if err := json.Unmarshal(respBody, &resultMap); err != nil {
		w.publishFailure(tenantID, jobType, fmt.Sprintf("Invalid JSON from sidecar: %v", err))
		return nil
	}

	// Publica resultado no stream stream:analytics:processed
	if _, err := w.publisher.PublishJSON(ctx, streams.StreamAnalyticsProcessed, resultMap); err != nil {
		w.logger.Error("Erro ao publicar resultado de ML no Redis Stream", zap.Error(err))
		return err
	}

	_ = w.redisCli.SetIdempotencyKey(ctx, idempotencyKey, 24*time.Hour)

	w.logger.Info("Job de ML concluído e publicado com sucesso",
		zap.String("tenantId", tenantID),
		zap.String("jobType", jobType),
	)

	return nil
}

func (w *MLWorker) publishFailure(tenantID, jobType, errMsg string) {
	result := map[string]any{
		"tenantId":     tenantID,
		"jobType":      jobType,
		"status":       "FAILED",
		"errorMessage": errMsg,
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = w.publisher.PublishJSON(ctx, streams.StreamAnalyticsProcessed, result)
}
