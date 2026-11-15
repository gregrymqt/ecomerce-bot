package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	Environment          string
	LogLevel             string
	RedisURL             string
	RedisPassword        string
	HealthPort           string
	ScraperConcurrency   int
	ScraperTimeout       time.Duration
	ConsumerPollInterval time.Duration
}

func Load() *Config {
	env := getEnv("ENVIRONMENT", "development")
	logLevel := getEnv("LOG_LEVEL", "INFO")
	redisURL := getEnv("REDIS_URL", "redis://localhost:6379/0")
	redisPassword := getEnv("REDIS_PASSWORD", "")
	healthPort := getEnv("HEALTH_PORT", "8000")

	concurrencyStr := getEnv("SCRAPER_CONCURRENCY", "5")
	concurrency, err := strconv.Atoi(concurrencyStr)
	if err != nil || concurrency < 1 {
		concurrency = 5
	}

	timeoutStr := getEnv("SCRAPER_TIMEOUT_SECONDS", "30")
	timeoutSec, err := strconv.Atoi(timeoutStr)
	if err != nil || timeoutSec < 5 {
		timeoutSec = 30
	}

	return &Config{
		Environment:          env,
		LogLevel:             strings.ToUpper(logLevel),
		RedisURL:             redisURL,
		RedisPassword:        redisPassword,
		HealthPort:           healthPort,
		ScraperConcurrency:   concurrency,
		ScraperTimeout:       time.Duration(timeoutSec) * time.Second,
		ConsumerPollInterval: 2 * time.Second,
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok && val != "" {
		return val
	}
	return fallback
}
