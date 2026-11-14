package streams

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

type Publisher struct {
	rdb *redis.Client
}

func NewPublisher(rdb *redis.Client) *Publisher {
	return &Publisher{rdb: rdb}
}

func (p *Publisher) PublishJSON(ctx context.Context, stream string, payload any) (string, error) {
	data, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal json for stream %s: %w", stream, err)
	}

	res, err := p.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: stream,
		Values: map[string]interface{}{
			"payload":   string(data),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}).Result()

	if err != nil {
		return "", fmt.Errorf("failed to xadd to stream %s: %w", stream, err)
	}

	return res, nil
}

func (p *Publisher) SendToDLQ(ctx context.Context, originalStream, originalID, consumerGroup, errorReason string, rawPayload string) error {
	dlqEntry := map[string]interface{}{
		"originalStream": originalStream,
		"originalId":     originalID,
		"consumerGroup":  consumerGroup,
		"error":          errorReason,
		"rawPayload":     rawPayload,
		"failedAt":       time.Now().UTC().Format(time.RFC3339),
	}

	data, _ := json.Marshal(dlqEntry)
	return p.rdb.XAdd(ctx, &redis.XAddArgs{
		Stream: StreamDLQ,
		Values: map[string]interface{}{
			"payload":   string(data),
			"timestamp": time.Now().UTC().Format(time.RFC3339),
		},
	}).Err()
}
