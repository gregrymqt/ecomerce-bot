package scraper

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"ecommercebot/goworker/internal/redis"
	"ecommercebot/goworker/internal/streams"

	redisPkg "github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type ScrapingRequestMessage struct {
	TenantID      string `json:"tenantId"`
	SKU           string `json:"sku"`
	URL           string `json:"url"`
	PromptContext string `json:"promptContext"`
	IsBYOK        bool   `json:"isByok"`
}

type ScrapedRawProductEvent struct {
	TenantID           string            `json:"tenantId"`
	SKU                string            `json:"sku"`
	URL                string            `json:"url"`
	RawTitle           string            `json:"rawTitle"`
	RawDescriptionHTML string            `json:"rawDescriptionHtml"`
	RawMarkdown        string            `json:"rawMarkdown"`
	Price              *float64          `json:"price"`
	Currency           string            `json:"currency"`
	Images             []string          `json:"images"`
	MetaAttributes     map[string]string `json:"metaAttributes"`
	PromptContext      string            `json:"promptContext"`
	IsBYOK             bool              `json:"isByok"`
	Success            bool              `json:"success"`
	ErrorMessage       *string           `json:"errorMessage"`
}

type ScraperWorker struct {
	parser    *Parser
	redisCli  *redis.Client
	publisher *streams.Publisher
	logger    *zap.Logger
}

func NewScraperWorker(
	parser *Parser,
	redisCli *redis.Client,
	publisher *streams.Publisher,
	logger *zap.Logger,
) *ScraperWorker {
	return &ScraperWorker{
		parser:    parser,
		redisCli:  redisCli,
		publisher: publisher,
		logger:    logger,
	}
}

func (w *ScraperWorker) ProcessMessage(ctx context.Context, msg redisPkg.XMessage) error {
	rawPayload, ok := msg.Values["payload"].(string)
	if !ok || rawPayload == "" {
		return fmt.Errorf("missing or empty payload in message id %s", msg.ID)
	}

	var req ScrapingRequestMessage
	if err := json.Unmarshal([]byte(rawPayload), &req); err != nil {
		w.logger.Error("Falha ao deserializar JSON de ScrapingRequest",
			zap.String("msgId", msg.ID),
			zap.Error(err),
		)
		// Emite evento de falha estruturado se tiver tenantId
		w.publishFailure("", "", "", "", false, fmt.Sprintf("Invalid JSON payload: %v", err))
		return nil
	}

	if req.TenantID == "" || req.URL == "" {
		w.logger.Warn("Mensagem de scraping com tenantId ou URL vazios", zap.String("msgId", msg.ID))
		return nil
	}

	// 1. Verificação de Idempotência no Redis (TTL 24h)
	canonicalURL := strings.ToLower(strings.TrimSpace(req.URL))
	hash := sha256.Sum256([]byte(canonicalURL))
	urlHash := hex.EncodeToString(hash[:])
	idempotencyKey := fmt.Sprintf("worker:idempotency:scraper:%s:%s:%s", req.TenantID, req.SKU, urlHash)

	alreadyProcessed, err := w.redisCli.IsAlreadyProcessed(ctx, idempotencyKey)
	if err == nil && alreadyProcessed {
		w.logger.Info("Job de scraping já processado anteriormente (idempotência ativa)",
			zap.String("tenantId", req.TenantID),
			zap.String("sku", req.SKU),
		)
		return nil
	}

	w.logger.Info("Iniciando scraping",
		zap.String("tenantId", req.TenantID),
		zap.String("sku", req.SKU),
		zap.String("url", req.URL),
	)

	// 2. Executa a extração HTTP/JSON-LD
	scrapeResult, err := w.parser.Parse(ctx, req.URL, req.PromptContext)
	if err != nil {
		w.logger.Warn("Falha ao extrair produto",
			zap.String("tenantId", req.TenantID),
			zap.String("sku", req.SKU),
			zap.Error(err),
		)
		w.publishFailure(req.TenantID, req.SKU, req.URL, req.PromptContext, req.IsBYOK, err.Error())
		return nil
	}

	// 3. Monta evento de sucesso
	responseEvent := ScrapedRawProductEvent{
		TenantID:           req.TenantID,
		SKU:                req.SKU,
		URL:                req.URL,
		RawTitle:           scrapeResult.Title,
		RawDescriptionHTML: scrapeResult.RawDescriptionHTML,
		RawMarkdown:        scrapeResult.RawMarkdown,
		Price:              scrapeResult.Price,
		Currency:           scrapeResult.Currency,
		Images:             scrapeResult.Images,
		MetaAttributes:     scrapeResult.MetaAttributes,
		PromptContext:      req.PromptContext,
		IsBYOK:             req.IsBYOK,
		Success:            true,
		ErrorMessage:       nil,
	}

	if _, pubErr := w.publisher.PublishJSON(ctx, streams.StreamScrapedResults, responseEvent); pubErr != nil {
		w.logger.Error("Erro ao publicar resultado de scraping no Redis Stream", zap.Error(pubErr))
		return pubErr
	}

	// 4. Marca chave de idempotência com TTL de 24h
	_ = w.redisCli.SetIdempotencyKey(ctx, idempotencyKey, 24*time.Hour)

	w.logger.Info("Scraping concluído e publicado com sucesso",
		zap.String("tenantId", req.TenantID),
		zap.String("sku", req.SKU),
	)

	return nil
}

func (w *ScraperWorker) publishFailure(
	tenantID, sku, targetURL, promptCtx string,
	isByok bool,
	errMsg string,
) {
	if tenantID == "" {
		return
	}
	failedEvent := ScrapedRawProductEvent{
		TenantID:      tenantID,
		SKU:           sku,
		URL:           targetURL,
		PromptContext: promptCtx,
		IsBYOK:        isByok,
		Success:       false,
		ErrorMessage:  &errMsg,
		Images:        make([]string, 0),
		MetaAttributes: make(map[string]string),
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, _ = w.publisher.PublishJSON(ctx, streams.StreamScrapedResults, failedEvent)
}
