-- ==============================================================================
-- Script 020: Tabela jobs e fila durável SKIP LOCKED (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.jobs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL,
    type          TEXT NOT NULL,                          -- 'scraping' | 'seo_enrichment' | 'export'
    payload       JSONB NOT NULL DEFAULT '{}',
    status        TEXT NOT NULL DEFAULT 'pending',       -- pending | running | completed | failed | retry
    attempts      INT  NOT NULL DEFAULT 0,
    locked_until  TIMESTAMPTZ,                           -- NULL = livre; != NULL = travado por consumer
    next_run_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice parcial: só rows prontas para consumo
CREATE INDEX IF NOT EXISTS ix_jobs_claimable
    ON public.jobs (next_run_at, id)
    WHERE status IN ('pending', 'retry');
