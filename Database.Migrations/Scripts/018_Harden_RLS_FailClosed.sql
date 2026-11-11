-- ==============================================================================
-- Script 018: Endurecimento Fail-Closed de Row-Level Security (RLS)
-- E-commerce Bot SaaS
-- Remove o fallback inseguro (SESSION_CONTEXT IS NULL AND IsSuperAdmin IS NULL)
-- que permitia leitura/escrita irrestrita quando o contexto da sessão não era definido.
-- ==============================================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;
GO

-- 1. Remove temporariamente a Security Policy vinculada (necessário para alterar função WITH SCHEMABINDING)
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy' AND schema_id = SCHEMA_ID('Security'))
BEGIN
    DROP SECURITY POLICY Security.TenantSecurityPolicy;
END
GO

-- 2. Recria a função de predicado em modo estritamente Fail-Closed
CREATE OR ALTER FUNCTION Security.fn_TenantAccessPredicate(@TenantId UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS AccessResult
       WHERE (@TenantId = CAST(SESSION_CONTEXT(N'TenantId') AS UNIQUEIDENTIFIER))
          OR (CAST(SESSION_CONTEXT(N'IsSuperAdmin') AS INT) = 1);
GO

-- 3. Recria a Security Policy em todas as 13 tabelas multi-tenant (scripts 014 e 015)
CREATE SECURITY POLICY Security.TenantSecurityPolicy
    -- 1. Produtos
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Products,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Products AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Products AFTER UPDATE,

    -- 2. Pedidos
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Orders,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Orders AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.Orders AFTER UPDATE,

    -- 3. Perfis de Cobrança do Tenant
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantBillingProfiles,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantBillingProfiles AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantBillingProfiles AFTER UPDATE,

    -- 4. Atribuições de Tráfego
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions AFTER UPDATE,

    -- 5. Logs de Consumo de LLM
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs AFTER UPDATE,

    -- 6. Logs de E-mails Transacionais
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs AFTER UPDATE,

    -- 7. Configurações de Tenant
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs AFTER UPDATE,

    -- 8. Atividades de Robôs
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities AFTER UPDATE,

    -- 9. Integrações E-commerce (Shopify / Nuvemshop)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations AFTER UPDATE,

    -- 10. Extrato e Transações de Crédito (CreditTransactions)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditTransactions,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditTransactions AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditTransactions AFTER UPDATE,

    -- 11. Credenciais BYOK do Tenant (TenantAiCredentials)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantAiCredentials,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantAiCredentials AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantAiCredentials AFTER UPDATE,

    -- 12. Mapeamentos SSO de Tenants
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings AFTER UPDATE,

    -- 13. Logs de Auditoria e Compliance (LGPD / AuditLogs)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AuditLogs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AuditLogs AFTER INSERT
    WITH (STATE = ON);
GO

COMMIT TRANSACTION;
GO
