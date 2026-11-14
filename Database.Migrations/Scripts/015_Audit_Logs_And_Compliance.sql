-- ==============================================================================
-- Script 015: Trilha de Auditoria Imutável (Append-Only) & Governança LGPD (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Criação da Tabela: AuditLogs (Trilha imutável para eventos de segurança, auth e IA)
CREATE TABLE IF NOT EXISTS dbo.AuditLogs (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NOT NULL,
    UserId UUID NULL,
    Action VARCHAR(100) NOT NULL,
    EntityName VARCHAR(100) NOT NULL,
    EntityId VARCHAR(100) NULL,
    OldValuesJson TEXT NULL,
    NewValuesJson TEXT NULL,
    IpAddress VARCHAR(50) NULL,
    UserAgent VARCHAR(500) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_AuditLogs PRIMARY KEY (Id),
    CONSTRAINT FK_AuditLogs_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
);

-- 2. Índice para Otimização de consultas sequenciais por Tenant e Data
CREATE INDEX IF NOT EXISTS IX_AuditLogs_Tenant_CreatedAt 
ON dbo.AuditLogs (TenantId, CreatedAt DESC);

-- 3. Inclusão da Tabela AuditLogs na Política de Segurança (Row-Level Security)
ALTER TABLE dbo.AuditLogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_AuditLogs ON dbo.AuditLogs;
CREATE POLICY TenantSecurityPolicy_AuditLogs ON dbo.AuditLogs
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));
