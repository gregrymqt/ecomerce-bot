-- ==============================================================================
-- Script 019: AI Provider Credits & Topups (FinOps de IA)
-- E-commerce Bot SaaS
-- Tabela para rastreamento de recargas, pagamentos e saldos em DeepSeek, Gemini e OpenRouter
-- ==============================================================================

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[AiProviderCredits]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[AiProviderCredits] (
        [Id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        [Provider] NVARCHAR(50) NOT NULL, -- DEEPSEEK, GEMINI, OPENROUTER
        [AmountPaid] DECIMAL(18,4) NOT NULL,
        [Currency] NVARCHAR(10) NOT NULL DEFAULT 'USD',
        [TokensCredited] BIGINT NOT NULL DEFAULT 0,
        [BalanceRemaining] DECIMAL(18,4) NOT NULL DEFAULT 0,
        [TransactionReference] NVARCHAR(150) NULL,
        [Source] NVARCHAR(50) NOT NULL DEFAULT 'MANUAL_ADMIN', -- WEBHOOK, MANUAL_ADMIN
        [Notes] NVARCHAR(500) NULL,
        [CreatedAt] DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT [PK_AiProviderCredits] PRIMARY KEY CLUSTERED ([Id] ASC)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_AiProviderCredits_Provider_CreatedAt' AND object_id = OBJECT_ID('dbo.AiProviderCredits'))
BEGIN
    CREATE NONCLUSTERED INDEX [IX_AiProviderCredits_Provider_CreatedAt]
    ON [dbo].[AiProviderCredits] ([Provider], [CreatedAt] DESC)
    INCLUDE ([AmountPaid], [TokensCredited], [BalanceRemaining], [Source]);
END
GO
