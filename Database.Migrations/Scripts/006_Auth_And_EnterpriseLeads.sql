-- ==============================================================================
-- Script 006: Captura e Gestão de Leads SSO Enterprise (Mini-CRM)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e Índices de Cobertura
-- ==============================================================================

-- 1. Tabela: EnterpriseLeads (Captura de Leads SSO Fake Door e Mini-CRM de Onboarding)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'EnterpriseLeads' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.EnterpriseLeads (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        Email NVARCHAR(255) NOT NULL,
        CompanyName NVARCHAR(255) NULL,
        JobTitle NVARCHAR(150) NULL,
        ExpectedVolume NVARCHAR(100) NULL,
        Phone NVARCHAR(50) NULL,
        TeamSize NVARCHAR(100) NULL,
        Notes NVARCHAR(MAX) NULL,
        Status NVARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'CONTACTED', 'CONVERTED', 'DISQUALIFIED'
        InternalNotes NVARCHAR(MAX) NULL,
        ConvertedTenantId UNIQUEIDENTIFIER NULL,
        ConvertedUserId UNIQUEIDENTIFIER NULL,
        IpAddress NVARCHAR(50) NULL,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_EnterpriseLeads PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_EnterpriseLeads_Email UNIQUE NONCLUSTERED (Email)
    );
END
GO

-- 2. Índice de Cobertura para Consultas e Gestão do CRM (Status, Data de Criação)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EnterpriseLeads_Status_CreatedAt' AND object_id = OBJECT_ID('dbo.EnterpriseLeads'))
BEGIN
    CREATE NONCLUSTERED INDEX IX_EnterpriseLeads_Status_CreatedAt
    ON dbo.EnterpriseLeads (Status, CreatedAt DESC)
    INCLUDE (Email, CompanyName, Phone, TeamSize, ConvertedTenantId);
END
GO
