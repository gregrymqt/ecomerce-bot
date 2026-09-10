-- ==============================================================================
-- Script 014: Row-Level Security (RLS) & Isolamento Multi-Tenant via SESSION_CONTEXT
-- E-commerce Bot SaaS
-- Padrão: Idempotente com SCHEMABINDING, Predicados Inline e Security Policy Ativa
-- Diretriz: Skill production-security (Seção 1.2: Defesa em Profundidade)
-- ==============================================================================

-- 1. Criação do Schema Security
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'Security')
BEGIN
    EXEC('CREATE SCHEMA Security');
END
GO

-- 2. Função de Predicado Inline de Segurança com SCHEMABINDING
CREATE OR ALTER FUNCTION Security.fn_TenantAccessPredicate(@TenantId UNIQUEIDENTIFIER)
RETURNS TABLE
WITH SCHEMABINDING
AS
RETURN SELECT 1 AS AccessResult
       WHERE (@TenantId = CAST(SESSION_CONTEXT(N'TenantId') AS UNIQUEIDENTIFIER))
          OR (CAST(SESSION_CONTEXT(N'IsSuperAdmin') AS INT) = 1)
          OR (SESSION_CONTEXT(N'TenantId') IS NULL AND SESSION_CONTEXT(N'IsSuperAdmin') IS NULL);
GO

-- 3. Criação Idempotente da Política de Segurança (TenantSecurityPolicy)
IF EXISTS (SELECT 1 FROM sys.security_policies WHERE name = 'TenantSecurityPolicy' AND schema_id = SCHEMA_ID('Security'))
BEGIN
    DROP SECURITY POLICY Security.TenantSecurityPolicy;
END
GO

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

    -- 4. Eventos de Consumo e Tarifação (Metering)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.MeteringEvents,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.MeteringEvents AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.MeteringEvents AFTER UPDATE,

    -- 5. Atribuições de Tráfego
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TrafficAttributions AFTER UPDATE,

    -- 6. Logs de Consumo de LLM
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.LLMUsageLogs AFTER UPDATE,

    -- 7. Logs de E-mails Transacionais
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.EmailLogs AFTER UPDATE,

    -- 8. Configurações de Tenant
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantConfigs AFTER UPDATE,

    -- 9. Atividades de Robôs
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.RobotActivities AFTER UPDATE,

    -- 10. Integrações E-commerce (Shopify / Nuvemshop)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.StoreIntegrations AFTER UPDATE,

    -- 11. Extrato de Créditos (Ledger)
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditLedger,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditLedger AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.CreditLedger AFTER UPDATE,

    -- 12. Créditos BYOK de Provedores de IA
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AiProviderCredits,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AiProviderCredits AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.AiProviderCredits AFTER UPDATE,

    -- 13. Mapeamentos SSO de Tenants
    ADD FILTER PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings AFTER INSERT,
    ADD BLOCK PREDICATE Security.fn_TenantAccessPredicate(TenantId) ON dbo.TenantSsoMappings AFTER UPDATE
    WITH (STATE = ON);
GO
