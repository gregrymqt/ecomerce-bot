-- ==============================================================================
-- Script 025: Remover Tabela Redundante dbo.UserAddresses
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF OBJECT_ID IS NOT NULL, DROP TABLE
-- Motivo: Substituída por dbo.TenantBillingProfiles (1:1 Tenant) e snapshot em dbo.Orders
-- ==============================================================================

IF OBJECT_ID(N'dbo.UserAddresses', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.UserAddresses;
END
GO
