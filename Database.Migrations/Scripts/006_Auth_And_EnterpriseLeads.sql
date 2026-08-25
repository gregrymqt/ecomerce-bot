-- ==============================================================================
-- Script 006: Auth e Fake Door SSO Enterprise Leads
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID())
-- ==============================================================================

-- 1. Tabela: EnterpriseLeads (Captura de Leads SSO Fake Door)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EnterpriseLeads' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EnterpriseLeads (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Email NVARCHAR(255) NOT NULL,
        CompanyName NVARCHAR(255) NULL,
        JobTitle NVARCHAR(150) NULL,
        ExpectedVolume NVARCHAR(100) NULL,
        IpAddress NVARCHAR(50) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_EnterpriseLeads PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_EnterpriseLeads_Email UNIQUE NONCLUSTERED (Email)
    );
END
GO
