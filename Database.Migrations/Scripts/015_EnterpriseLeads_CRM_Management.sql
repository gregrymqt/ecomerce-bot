-- ==============================================================================
-- Script 015: Gestão e Mini-CRM de Leads SSO Enterprise
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS / COL_LENGTH, UNIQUEIDENTIFIER
-- ==============================================================================

-- 1. Adição de colunas na tabela dbo.EnterpriseLeads para controle de CRM e Onboarding
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EnterpriseLeads' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    IF COL_LENGTH('dbo.EnterpriseLeads', 'Phone') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD Phone NVARCHAR(50) NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'TeamSize') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD TeamSize NVARCHAR(100) NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'Notes') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD Notes NVARCHAR(MAX) NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'Status') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD Status NVARCHAR(50) NOT NULL CONSTRAINT DF_EnterpriseLeads_Status DEFAULT 'PENDING';
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'InternalNotes') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD InternalNotes NVARCHAR(MAX) NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'ConvertedTenantId') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD ConvertedTenantId UNIQUEIDENTIFIER NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'ConvertedUserId') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD ConvertedUserId UNIQUEIDENTIFIER NULL;
    END

    IF COL_LENGTH('dbo.EnterpriseLeads', 'UpdatedAt') IS NULL
    BEGIN
        ALTER TABLE dbo.EnterpriseLeads ADD UpdatedAt DATETIMEOFFSET NOT NULL CONSTRAINT DF_EnterpriseLeads_UpdatedAt DEFAULT SYSDATETIMEOFFSET();
    END
END
GO

-- 2. Índice de cobertura para consultas do CRM (Status, Data de Criação)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnterpriseLeads_Status_CreatedAt' AND object_id = OBJECT_ID('dbo.EnterpriseLeads'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnterpriseLeads_Status_CreatedAt
    ON dbo.EnterpriseLeads (Status, CreatedAt DESC)
    INCLUDE (Email, CompanyName, Phone, TeamSize, ConvertedTenantId);
END
GO
