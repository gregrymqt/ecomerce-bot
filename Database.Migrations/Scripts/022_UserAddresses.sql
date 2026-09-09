-- ==============================================================================
-- Script 020: User Addresses, Endereços dos usuários
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()), Índices de Cobertura e FKs ON DELETE CASCADE
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserAddresses' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.UserAddresses (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NOT NULL,
        UserId UNIQUEIDENTIFIER NOT NULL,
        ZipCode NVARCHAR(10) NOT NULL,
        Street NVARCHAR(150) NOT NULL,
        Number NVARCHAR(20) NOT NULL,
        Complement NVARCHAR(50) NULL,
        Neighborhood NVARCHAR(100) NOT NULL,
        City NVARCHAR(100) NOT NULL,
        State NVARCHAR(2) NOT NULL,
        IsDefault BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT PK_UserAddresses PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_UserAddresses_Tenants FOREIGN KEY (TenantId)
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE,
        CONSTRAINT FK_UserAddresses_Users FOREIGN KEY (UserId)
            REFERENCES dbo.Users(Id)
    );

    -- Índice de busca rápida no checkout por usuário dentro do Tenant
    CREATE NONCLUSTERED INDEX IX_UserAddresses_Tenant_User
    ON dbo.UserAddresses (TenantId, UserId)
    INCLUDE (ZipCode, Street, Number, Neighborhood, City, State, IsDefault);

    -- Índice único filtrado: Garante que cada usuário tenha no máximo 1 endereço padrão
    CREATE UNIQUE NONCLUSTERED INDEX UQ_UserAddresses_Tenant_User_Default
    ON dbo.UserAddresses (TenantId, UserId)
    WHERE IsDefault = 1;
END
GO