-- ==============================================================================
-- Script 007: Telemetria e Auditoria de LLM (LLMUsageLogs) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: LLMUsageLogs (Auditoria Fina de Tokens, Latência e Custos de Inferência)
CREATE TABLE IF NOT EXISTS dbo.LLMUsageLogs (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    ProductId VARCHAR(150) NULL,
    Provider VARCHAR(100) NOT NULL,
    ModelUsed VARCHAR(100) NOT NULL,
    PromptTokens INT NOT NULL DEFAULT 0,
    CompletionTokens INT NOT NULL DEFAULT 0,
    TotalTokens INT NOT NULL DEFAULT 0,
    EstimatedCostUsd NUMERIC(18,6) NOT NULL DEFAULT 0.000000,
    IsByok BOOLEAN NOT NULL DEFAULT FALSE,
    ExecutionTimeMs INT NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_LLMUsageLogs PRIMARY KEY (Id),
    CONSTRAINT FK_LLMUsageLogs_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_LLMUsageLogs_TenantId_CreatedAt 
ON dbo.LLMUsageLogs (TenantId, CreatedAt DESC) 
INCLUDE (TotalTokens, EstimatedCostUsd);
