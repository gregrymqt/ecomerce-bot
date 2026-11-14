-- ==============================================================================
-- Script 006: Captura e Gestão de Leads SSO Enterprise (Mini-CRM) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

-- 1. Tabela: EnterpriseLeads (Captura de Leads SSO Fake Door e Mini-CRM de Onboarding)
CREATE TABLE IF NOT EXISTS dbo.EnterpriseLeads (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    Email VARCHAR(255) NOT NULL,
    CompanyName VARCHAR(255) NULL,
    JobTitle VARCHAR(150) NULL,
    ExpectedVolume VARCHAR(100) NULL,
    Phone VARCHAR(50) NULL,
    TeamSize VARCHAR(100) NULL,
    Notes TEXT NULL,
    Status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    InternalNotes TEXT NULL,
    ConvertedTenantId UUID NULL,
    ConvertedUserId UUID NULL,
    IpAddress VARCHAR(50) NULL,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UpdatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_EnterpriseLeads PRIMARY KEY (Id),
    CONSTRAINT UQ_EnterpriseLeads_Email UNIQUE (Email)
);

CREATE INDEX IF NOT EXISTS IX_EnterpriseLeads_Status_CreatedAt
ON dbo.EnterpriseLeads (Status, CreatedAt DESC)
INCLUDE (Email, CompanyName, Phone, TeamSize, ConvertedTenantId);
