package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"ecommercebot/goworker/internal/config"
	"ecommercebot/goworker/internal/health"
	"ecommercebot/goworker/internal/ml"
	"ecommercebot/goworker/internal/redis"
	"ecommercebot/goworker/internal/scraper"
	"ecommercebot/goworker/internal/streams"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func buildLogger(env, level string) (*zap.Logger, error) {
	var zapLevel zapcore.Level
	switch level {
	case "DEBUG":
		zapLevel = zapcore.DebugLevel
	case "WARN":
		zapLevel = zapcore.WarnLevel
	case "ERROR":
		zapLevel = zapcore.ErrorLevel
	default:
		zapLevel = zapcore.InfoLevel
	}

	var zapCfg zap.Config
	if env == "production" {
		zapCfg = zap.NewProductionConfig()
	} else {
		zapCfg = zap.NewDevelopmentConfig()
	}
	zapCfg.Level = zap.NewAtomicLevelAt(zapLevel)
	zapCfg.EncoderConfig.TimeKey = "timestamp"
	zapCfg.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	return zapCfg.Build()
}

func main() {
	cfg := config.Load()

	logger, err := buildLogger(cfg.Environment, cfg.LogLevel)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Falha ao inicializar logger: %v\n", err)
		os.Exit(1)
	}
	defer logger.Sync()

	logger.Info("Iniciando EcommerceBot.GoWorker",
		zap.String("environment", cfg.Environment),
		zap.String("logLevel", cfg.LogLevel),
		zap.String("mlSidecarUrl", cfg.MLSidecarURL),
		zap.Int("scraperConcurrency", cfg.ScraperConcurrency),
	)

	// Conexão Redis
	redisCli, err := redis.NewClient(cfg.RedisURL, cfg.RedisPassword)
	if err != nil {
		logger.Fatal("Falha crítica ao conectar no Redis", zap.Error(err))
	}
	defer redisCli.Close()
	logger.Info("Conexão com Redis estabelecida com sucesso")

	// Contexto global com cancelamento em SIGINT / SIGTERM
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// Componentes de Mensageria
	publisher := streams.NewPublisher(redisCli.Raw())
	consumerMgr := streams.NewConsumerGroupManager(redisCli.Raw(), publisher, logger)

	// Parser e Workers
	parser := scraper.NewParser(cfg.ScraperTimeout)
	scraperWorker := scraper.NewScraperWorker(parser, redisCli, publisher, logger)
	mlWorker := ml.NewMLWorker(cfg.MLSidecarURL, redisCli, publisher, logger)

	hostname, _ := os.Hostname()
	if hostname == "" {
		hostname = "go-worker"
	}

	var wg sync.WaitGroup

	// Consumidor 1: stream:scraping:prod
	wg.Add(1)
	go func() {
		defer wg.Done()
		consumerName := fmt.Sprintf("%s-prod-%d", hostname, os.Getpid())
		if err := consumerMgr.StartConsuming(
			ctx,
			streams.StreamScrapingProd,
			streams.GroupScraper,
			consumerName,
			scraperWorker.ProcessMessage,
			int64(cfg.ScraperConcurrency),
			2*time.Second,
		); err != nil {
			logger.Error("Erro no consumidor stream:scraping:prod", zap.Error(err))
		}
	}()

	// Consumidor 2: stream:scraping:demo
	wg.Add(1)
	go func() {
		defer wg.Done()
		consumerName := fmt.Sprintf("%s-demo-%d", hostname, os.Getpid())
		if err := consumerMgr.StartConsuming(
			ctx,
			streams.StreamScrapingDemo,
			streams.GroupScraper,
			consumerName,
			scraperWorker.ProcessMessage,
			int64(cfg.ScraperConcurrency),
			2*time.Second,
		); err != nil {
			logger.Error("Erro no consumidor stream:scraping:demo", zap.Error(err))
		}
	}()

	// Consumidor 3: stream:analytics:ml
	wg.Add(1)
	go func() {
		defer wg.Done()
		consumerName := fmt.Sprintf("%s-ml-%d", hostname, os.Getpid())
		if err := consumerMgr.StartConsuming(
			ctx,
			streams.StreamAnalyticsML,
			streams.GroupML,
			consumerName,
			mlWorker.ProcessMessage,
			2,
			2*time.Second,
		); err != nil {
			logger.Error("Erro no consumidor stream:analytics:ml", zap.Error(err))
		}
	}()

	// Servidor HTTP de Health Checks
	healthServer := health.NewServer(cfg.HealthPort, redisCli, logger)
	go func() {
		if err := healthServer.Start(); err != nil {
			logger.Error("Erro no servidor de health check", zap.Error(err))
		}
	}()

	// Aguarda sinal de encerramento
	<-ctx.Done()
	logger.Info("Sinal de encerramento recebido. Iniciando graceful shutdown...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	_ = healthServer.Shutdown(shutdownCtx)

	// Aguarda goroutines de consumo finalizarem
	c := make(chan struct{})
	go func() {
		wg.Wait()
		close(c)
	}()

	select {
	case <-c:
		logger.Info("Todos os consumidores encerrados com sucesso.")
	case <-shutdownCtx.Done():
		logger.Warn("Timeout no graceful shutdown de consumidores.")
	}

	logger.Info("GoWorker finalizado.")
}
