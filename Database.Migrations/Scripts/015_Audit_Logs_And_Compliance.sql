-- ==============================================================================
-- Script 015: Trilha de Auditoria Imutável (Append-Only) & Governança LGPD / SOC 2
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, Clustered Index (TenantId, CreatedAt DESC)
--         e integração com Row-Level Security (Security.TenantSecurityPolicy)
-- Diretriz: Skill production-security (Seção 5: Governança, LGPD & Trilha de Auditoria)
-- ==============================================================================

-- 1. Criação da Tabela: AuditLogs (Trilha imutável para eventos de segurança, auth e IA)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'AuditLogs' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.AuditLogs (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NULL,
        Action NVARCHAR(100) NOT NULL, -- Ex: 'AUTH_LOGIN', 'USER_REGISTER', 'PASSWORD_CHANGED', 'BYOK_KEY_ROTATED', 'DATA_ERASURE_REQUESTED'
        EntityName NVARCHAR(100) NOT NULL, -- Ex: 'User', 'TenantAiCredential', 'StoreIntegration', 'Tenant'
        EntityId NVARCHAR(100) NULL,
        OldValuesJson NVARCHAR(MAX) NULL,
        NewValuesJson NVARCHAR(MAX) NULL,
        IpAddress NVARCHAR(50) NULL,
        UserAgent NVARCHAR(500) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_AuditLogs PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_AuditLogs_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
    );
END
GO

-- 2. Índice Clustered: Otimização para consultas sequenciais e auditoria por Tenant e Data
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AuditLogs_Tenant_CreatedAt' AND object_id = OBJECT_ID('dbo.AuditLogs'))
BEGIN
    CREATE CLUSTERED INDEX IX_AuditLogs_Tenant_CreatedAt 
    ON dbo.AuditLogs (TenantId, CreatedAt DESC);
END
GO

-- 3. Inclusão da Tabela AuditLogs na Política de Segurança (Row-Level Security)
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy' AND schema_id = SCHEMA_ID('Security'))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM sys.security_predicates sp
        JOIN sys.objects o ON sp.target_object_id = o.object_id
        WHERE o.name = 'AuditLogs'
    )
    BEGIN
        ALTER SECURITY POLICY Security.TenantSecurityPolicy
            ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AuditLogs,
            ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AuditLogs AFTER INSERT;
    END
END
GO
