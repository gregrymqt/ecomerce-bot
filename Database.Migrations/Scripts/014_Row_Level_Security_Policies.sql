-- ==============================================================================
-- Script 014: Row-Level Security (RLS) & Isolamento Multi-Tenant (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS security;

-- Função de Predicado de Segurança Multi-Tenant
CREATE OR REPLACE FUNCTION security.fn_TenantAccessPredicate(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        p_tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::UUID
        OR NULLIF(current_setting('app.is_super_admin', true), '') = '1'
        OR (current_setting('app.tenant_id', true) IS NULL AND current_setting('app.is_super_admin', true) IS NULL)
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Aplicação de Políticas de RLS em Tabelas Tenant-Scoped

-- 1. Produtos
ALTER TABLE dbo.Products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_Products ON dbo.Products;
CREATE POLICY TenantSecurityPolicy_Products ON dbo.Products
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 2. Pedidos
ALTER TABLE dbo.Orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_Orders ON dbo.Orders;
CREATE POLICY TenantSecurityPolicy_Orders ON dbo.Orders
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 3. Perfis de Cobrança do Tenant
ALTER TABLE dbo.TenantBillingProfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_TenantBillingProfiles ON dbo.TenantBillingProfiles;
CREATE POLICY TenantSecurityPolicy_TenantBillingProfiles ON dbo.TenantBillingProfiles
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 4. Atribuições de Tráfego
ALTER TABLE dbo.TrafficAttributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_TrafficAttributions ON dbo.TrafficAttributions;
CREATE POLICY TenantSecurityPolicy_TrafficAttributions ON dbo.TrafficAttributions
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 5. Logs de Consumo de LLM
ALTER TABLE dbo.LLMUsageLogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_LLMUsageLogs ON dbo.LLMUsageLogs;
CREATE POLICY TenantSecurityPolicy_LLMUsageLogs ON dbo.LLMUsageLogs
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 6. Logs de E-mails Transacionais
ALTER TABLE dbo.EmailLogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_EmailLogs ON dbo.EmailLogs;
CREATE POLICY TenantSecurityPolicy_EmailLogs ON dbo.EmailLogs
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 7. Configurações de Tenant
ALTER TABLE dbo.TenantConfigs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_TenantConfigs ON dbo.TenantConfigs;
CREATE POLICY TenantSecurityPolicy_TenantConfigs ON dbo.TenantConfigs
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 8. Atividades de Robôs
ALTER TABLE dbo.RobotActivities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_RobotActivities ON dbo.RobotActivities;
CREATE POLICY TenantSecurityPolicy_RobotActivities ON dbo.RobotActivities
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 9. Integrações E-commerce
ALTER TABLE dbo.StoreIntegrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_StoreIntegrations ON dbo.StoreIntegrations;
CREATE POLICY TenantSecurityPolicy_StoreIntegrations ON dbo.StoreIntegrations
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 10. Extrato e Transações de Crédito
ALTER TABLE dbo.CreditTransactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_CreditTransactions ON dbo.CreditTransactions;
CREATE POLICY TenantSecurityPolicy_CreditTransactions ON dbo.CreditTransactions
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 11. Credenciais BYOK do Tenant
ALTER TABLE dbo.TenantAiCredentials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_TenantAiCredentials ON dbo.TenantAiCredentials;
CREATE POLICY TenantSecurityPolicy_TenantAiCredentials ON dbo.TenantAiCredentials
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));

-- 12. Mapeamentos SSO de Tenants
ALTER TABLE dbo.TenantSsoMappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS TenantSecurityPolicy_TenantSsoMappings ON dbo.TenantSsoMappings;
CREATE POLICY TenantSecurityPolicy_TenantSsoMappings ON dbo.TenantSsoMappings
    FOR ALL
    USING (security.fn_TenantAccessPredicate(TenantId))
    WITH CHECK (security.fn_TenantAccessPredicate(TenantId));
