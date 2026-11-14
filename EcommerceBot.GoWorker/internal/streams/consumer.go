package streams

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"
	"go.uber.org/zap"
)

type MessageHandler func(ctx context.Context, msg redis.XMessage) error

type ConsumerGroupManager struct {
	rdb       *redis.Client
	publisher *Publisher
	logger    *zap.Logger
}

func NewConsumerGroupManager(rdb *redis.Client, publisher *Publisher, logger *zap.Logger) *ConsumerGroupManager {
	return &ConsumerGroupManager{
		rdb:       rdb,
		publisher: publisher,
		logger:    logger,
	}
}

func (m *ConsumerGroupManager) EnsureGroup(ctx context.Context, stream, group string) error {
	err := m.rdb.XGroupCreateMkStream(ctx, stream, group, "$").Err()
	if err != nil && !strings.Contains(err.Error(), "BUSYGROUP") {
		return fmt.Errorf("failed to create consumer group %s for stream %s: %w", group, stream, err)
	}
	return nil
}

func (m *ConsumerGroupManager) StartConsuming(
	ctx context.Context,
	stream string,
	group string,
	consumerName string,
	handler MessageHandler,
	batchSize int64,
	blockDuration time.Duration,
) error {
	if err := m.EnsureGroup(ctx, stream, group); err != nil {
		return err
	}

	m.logger.Info("Iniciando consumo de stream",
		zap.String("stream", stream),
		zap.String("group", group),
		zap.String("consumer", consumerName),
	)

	// Goroutine de auto-claim para mensagens pendentes abandonadas
	go m.runAutoClaim(ctx, stream, group, consumerName, handler)

	for {
		select {
		case <-ctx.Done():
			m.logger.Info("Encerrando consumidor de stream", zap.String("stream", stream))
			return nil
		default:
		}

		entries, err := m.rdb.XReadGroup(ctx, &redis.XReadGroupArgs{
			Group:    group,
			Consumer: consumerName,
			Streams:  []string{stream, ">"},
			Count:    batchSize,
			Block:    blockDuration,
		}).Result()

		if err != nil {
			if errors.Is(err, redis.Nil) || errors.Is(err, context.Canceled) {
				continue
			}
			m.logger.Error("Erro ao ler stream", zap.String("stream", stream), zap.Error(err))
			time.Sleep(1 * time.Second)
			continue
		}

		for _, streamEntry := range entries {
			for _, message := range streamEntry.Messages {
				m.processMessage(ctx, stream, group, message, handler)
			}
		}
	}
}

func (m *ConsumerGroupManager) processMessage(
	ctx context.Context,
	stream string,
	group string,
	msg redis.XMessage,
	handler MessageHandler,
) {
	processCtx, cancel := context.WithTimeout(ctx, 3*time.Minute)
	defer cancel()

	if err := handler(processCtx, msg); err != nil {
		m.logger.Error("Erro ao processar mensagem do stream",
			zap.String("stream", stream),
			zap.String("id", msg.ID),
			zap.Error(err),
		)
		rawPayload := ""
		if p, ok := msg.Values["payload"].(string); ok {
			rawPayload = p
		}
		_ = m.publisher.SendToDLQ(processCtx, stream, msg.ID, group, err.Error(), rawPayload)
	}

	// XAck confirma que a mensagem foi processada ou roteada para a DLQ
	if err := m.rdb.XAck(ctx, stream, group, msg.ID).Err(); err != nil {
		m.logger.Error("Erro ao enviar XACK", zap.String("stream", stream), zap.String("id", msg.ID), zap.Error(err))
	}
}

func (m *ConsumerGroupManager) runAutoClaim(
	ctx context.Context,
	stream string,
	group string,
	consumerName string,
	handler MessageHandler,
) {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			res, _, err := m.rdb.XAutoClaim(ctx, &redis.XAutoClaimArgs{
				Stream:   stream,
				Group:    group,
				Consumer: consumerName,
				MinIdle:  60 * time.Second,
				Start:    "0-0",
				Count:    10,
			}).Result()

			if err != nil {
				if !errors.Is(err, redis.Nil) && !errors.Is(err, context.Canceled) {
					m.logger.Warn("Erro no XAUTOCLAIM", zap.String("stream", stream), zap.Error(err))
				}
				continue
			}

			for _, msg := range res {
				m.logger.Info("Recuperando mensagem ociosa via XAUTOCLAIM",
					zap.String("stream", stream),
					zap.String("id", msg.ID),
				)
				m.processMessage(ctx, stream, group, msg, handler)
			}
		}
	}
}
