package health

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"ecommercebot/goworker/internal/redis"

	"go.uber.org/zap"
)

type Server struct {
	httpServer *http.Server
	redisCli   *redis.Client
	logger     *zap.Logger
}

func NewServer(port string, redisCli *redis.Client, logger *zap.Logger) *Server {
	mux := http.NewServeMux()
	s := &Server{
		redisCli: redisCli,
		logger:   logger,
	}

	mux.HandleFunc("/health/live", s.liveHandler)
	mux.HandleFunc("/health/ready", s.readyHandler)

	s.httpServer = &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	return s
}

func (s *Server) Start() error {
	s.logger.Info("Iniciando servidor de health check", zap.String("addr", s.httpServer.Addr))
	if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (s *Server) Shutdown(ctx context.Context) error {
	return s.httpServer.Shutdown(ctx)
}

func (s *Server) liveHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"UP","probe":"liveness"}`))
}

func (s *Server) readyHandler(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	if err := s.redisCli.Raw().Ping(ctx).Err(); err != nil {
		w.WriteHeader(http.StatusServiceUnavailable)
		_, _ = w.Write([]byte(fmt.Sprintf(`{"status":"DOWN","probe":"readiness","error":"%s"}`, err.Error())))
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"UP","probe":"readiness"}`))
}
