# ==============================================================================
# Build Stage
# ==============================================================================
FROM golang:1.23-alpine AS builder

WORKDIR /app

RUN apk add --no-cache git ca-certificates tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s" \
    -o /app/bin/goworker ./cmd/worker

# ==============================================================================
# Production Image
# ==============================================================================
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata && \
    addgroup -g 10001 -S appgroup && \
    adduser -u 10001 -S appuser -G appgroup

COPY --from=builder /app/bin/goworker /app/goworker

USER appuser:appgroup

EXPOSE 8000

ENTRYPOINT ["/app/goworker"]
