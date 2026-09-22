-- ==============================================================================
-- Script 017: Diretrizes de SEO por Categoria (CategorySeoGuidelines)
-- E-commerce Bot SaaS
-- Padrão: Idempotente com IF NOT EXISTS, UNIQUEIDENTIFIER (NEWSEQUENTIALID()),
--         DATETIMEOFFSET (SYSDATETIMEOFFSET()) e FKs ON DELETE CASCADE
-- ==============================================================================

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CategorySeoGuidelines' AND schema_id = SCHEMA_ID('dbo'))
BEGIN
    CREATE TABLE dbo.CategorySeoGuidelines (
        Id UNIQUEIDENTIFIER NOT NULL DEFAULT NEWSEQUENTIALID(),
        TenantId UNIQUEIDENTIFIER NULL, -- NULL = Diretriz Padrão/Global da Plataforma
        CategoryPattern NVARCHAR(150) NOT NULL, -- ex: 'Moda%', 'Eletrônicos%', 'Beleza%', '%'
        MandatoryKeywords NVARCHAR(MAX) NULL, -- JSON array: ["modelagem", "caimento", "tecido"]
        RecommendedTone NVARCHAR(200) NOT NULL DEFAULT 'Persuasivo, técnico e focado em benefícios',
        FewShotExampleTitle NVARCHAR(200) NULL,
        FewShotExampleDescription NVARCHAR(1000) NULL,
        IsActive BIT NOT NULL DEFAULT 1,
        CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
        CONSTRAINT PK_CategorySeoGuidelines PRIMARY KEY NONCLUSTERED (Id),
        CONSTRAINT FK_CategorySeoGuidelines_Tenants FOREIGN KEY (TenantId) 
            REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
    );

    -- Índice de cobertura otimizado para busca por padrão de categoria e eliminação de Key Lookups
    CREATE NONCLUSTERED INDEX IX_CategorySeoGuidelines_Lookup
    ON dbo.CategorySeoGuidelines (IsActive, CategoryPattern)
    INCLUDE (TenantId, MandatoryKeywords, RecommendedTone, FewShotExampleTitle, FewShotExampleDescription);
END
GO

-- ==============================================================================
-- Seeds Globais Canônicos (TenantId = NULL)
-- ==============================================================================

-- 1. Moda e Vestuário
IF NOT EXISTS (SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Moda%')
BEGIN
    INSERT INTO dbo.CategorySeoGuidelines (
        TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
        FewShotExampleTitle, FewShotExampleDescription, IsActive
    ) VALUES (
        NULL,
        'Moda%',
        '["modelagem", "caimento", "tecido", "conforto", "estilo"]',
        'Persuasivo, elegante, focado em estilo de vida, modelagem e caimento',
        'Vestido Midi Canelado Manga Curta Elegance - Conforto e Sofisticação',
        'Realce sua presença com o Vestido Midi Elegance. Confeccionado em malha canelada de alta densidade, valoriza a silhueta com caimento impecável e toque extremamente macio. Perfeito para transitar do ambiente profissional a encontros casuais com charme e elegância contemporânea.',
        1
    );
END
GO

-- 2. Eletrônicos e Tecnologia
IF NOT EXISTS (SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Eletrônicos%')
BEGIN
    INSERT INTO dbo.CategorySeoGuidelines (
        TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
        FewShotExampleTitle, FewShotExampleDescription, IsActive
    ) VALUES (
        NULL,
        'Eletrônicos%',
        '["especificações técnicas", "conectividade", "bateria", "desempenho", "garantia"]',
        'Técnico, autoritário, objetivo e focado em performance e especificações',
        'Fone de Ouvido Bluetooth SoundPro Max - Cancelamento de Ruído e 40h de Bateria',
        'Eleve sua experiência sonora ao ápice com o SoundPro Max. Equipado com drivers dinâmicos de 40mm e Cancelamento Ativo de Ruído (ANC) híbrido, entrega agudos cristalinos e graves profundos. Conexão Bluetooth 5.3 estável, bateria de até 40 horas contínuas e homologação completa com garantia nacional.',
        1
    );
END
GO

-- 3. Beleza e Cosméticos
IF NOT EXISTS (SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Beleza%')
BEGIN
    INSERT INTO dbo.CategorySeoGuidelines (
        TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
        FewShotExampleTitle, FewShotExampleDescription, IsActive
    ) VALUES (
        NULL,
        'Beleza%',
        '["modo de uso", "ativos", "tipo de pele", "textura", "dermatologicamente testado"]',
        'Inspirador, acolhedor, dermatologicamente seguro e focado em autocuidado',
        'Sérum Facial Hidratante Glow Vitamina C 15% - Uniformizador e Firmeza',
        'Desperte o viço natural da sua pele com o Sérum Facial Glow. Formulado com 15% de Vitamina C estabilizada e Ácido Hialurônico, combate radicais livres, suaviza manchas e melhora a textura cutânea. Fórmula leve de rápida absorção, livre de óleos e dermatologicamente testada para todos os tipos de pele.',
        1
    );
END
GO

-- 4. Casa & Decoração
IF NOT EXISTS (SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Casa & Decoração%')
BEGIN
    INSERT INTO dbo.CategorySeoGuidelines (
        TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
        FewShotExampleTitle, FewShotExampleDescription, IsActive
    ) VALUES (
        NULL,
        'Casa & Decoração%',
        '["dimensões", "material", "durabilidade", "design", "fácil limpeza"]',
        'Acolhedor, funcional, refinado e focado em bem-estar e design de interiores',
        'Luminária de Mesa Nórdica Minimalista em Madeira e Metal Fosco',
        'Transforme seu ambiente em um refúgio de aconchego com a Luminária de Mesa Nórdica. Combinando base em madeira natural tratada e cúpula em metal fosco orientável, harmoniza estética contemporânea e iluminação difusa suave. Ideal para home office, cabeceira ou leitura.',
        1
    );
END
GO

-- 5. Geral / Fallback Universal
IF NOT EXISTS (SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = '%')
BEGIN
    INSERT INTO dbo.CategorySeoGuidelines (
        TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
        FewShotExampleTitle, FewShotExampleDescription, IsActive
    ) VALUES (
        NULL,
        '%',
        '["qualidade garantida", "pronta entrega", "custo-benefício"]',
        'Persuasivo, claro, empático e focado na proposta de valor e eliminação de dúvidas',
        'Produto Premium de Alta Performance e Qualidade Comprovada',
        'Descubra a combinação ideal entre funcionalidade superior e excelência no acabamento. Desenvolvido para atender aos mais rigorosos padrões de qualidade, entrega durabilidade excepcional e facilidade de uso diário com satisfação garantida.',
        1
    );
END
GO
