-- ==============================================================================
-- Script 017: Diretrizes de SEO por Categoria (CategorySeoGuidelines) (PostgreSQL 16)
-- E-commerce Bot SaaS
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS dbo;

CREATE TABLE IF NOT EXISTS dbo.CategorySeoGuidelines (
    Id UUID NOT NULL DEFAULT gen_random_uuid(),
    TenantId UUID NULL,
    CategoryPattern VARCHAR(150) NOT NULL,
    MandatoryKeywords TEXT NULL,
    RecommendedTone VARCHAR(200) NOT NULL DEFAULT 'Persuasivo, técnico e focado em benefícios',
    FewShotExampleTitle VARCHAR(200) NULL,
    FewShotExampleDescription VARCHAR(1000) NULL,
    IsActive BOOLEAN NOT NULL DEFAULT TRUE,
    CreatedAt TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT PK_CategorySeoGuidelines PRIMARY KEY (Id),
    CONSTRAINT FK_CategorySeoGuidelines_Tenants FOREIGN KEY (TenantId) 
        REFERENCES dbo.Tenants(Id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS IX_CategorySeoGuidelines_Lookup
ON dbo.CategorySeoGuidelines (IsActive, CategoryPattern)
INCLUDE (TenantId, MandatoryKeywords, RecommendedTone, FewShotExampleTitle, FewShotExampleDescription);

-- Seeds Globais Canônicos (TenantId = NULL)

-- 1. Moda e Vestuário
INSERT INTO dbo.CategorySeoGuidelines (
    TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
    FewShotExampleTitle, FewShotExampleDescription, IsActive
) 
SELECT 
    NULL,
    'Moda%',
    '["modelagem", "caimento", "tecido", "conforto", "estilo"]',
    'Persuasivo, elegante, focado em estilo de vida, modelagem e caimento',
    'Vestido Midi Canelado Manga Curta Elegance - Conforto e Sofisticação',
    'Realce sua presença com o Vestido Midi Elegance. Confeccionado em malha canelada de alta densidade, valoriza a silhueta com caimento impecável e toque extremamente macio. Perfeito para transitar do ambiente profissional a encontros casuais com charme e elegância contemporânea.',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Moda%'
);

-- 2. Eletrônicos e Tecnologia
INSERT INTO dbo.CategorySeoGuidelines (
    TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
    FewShotExampleTitle, FewShotExampleDescription, IsActive
) 
SELECT 
    NULL,
    'Eletrônicos%',
    '["especificações técnicas", "conectividade", "bateria", "desempenho", "garantia"]',
    'Técnico, autoritário, objetivo e focado em performance e especificações',
    'Fone de Ouvido Bluetooth SoundPro Max - Cancelamento de Ruído e 40h de Bateria',
    'Eleve sua experiência sonora ao ápice com o SoundPro Max. Equipado com drivers dinâmicos de 40mm e Cancelamento Ativo de Ruído (ANC) híbrido, entrega agudos cristalinos e graves profundos. Conexão Bluetooth 5.3 estável, bateria de até 40 horas contínuas e homologação completa com garantia nacional.',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Eletrônicos%'
);

-- 3. Beleza e Cosméticos
INSERT INTO dbo.CategorySeoGuidelines (
    TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
    FewShotExampleTitle, FewShotExampleDescription, IsActive
) 
SELECT 
    NULL,
    'Beleza%',
    '["ingredientes ativos", "modo de uso", "benefícios", "dermatologicamente testado", "tipo de pele"]',
    'Acolhedor, informativo, sensorial e focado em autocuidado e eficácia',
    'Sérum Facial Antioxidante Vitamina C 15% - Uniformizador e Iluminador 30ml',
    'Desperte a radiância natural da sua pele com o Sérum Facial Vitamina C 15%. Formulado com vitamina C pura estabilizada e ácido ferúlico, combate os radicais livres, suaviza manchas e estimula a síntese de colágeno. Textura leve de rápida absorção, dermatologicamente testado e ideal para todos os tipos de pele.',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Beleza%'
);

-- 4. Casa, Decoração e Utilidades
INSERT INTO dbo.CategorySeoGuidelines (
    TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
    FewShotExampleTitle, FewShotExampleDescription, IsActive
) 
SELECT 
    NULL,
    'Casa%',
    '["material", "dimensões", "durabilidade", "design", "funcionalidade"]',
    'Prático, acolhedor, sofisticado e focado em bem-estar e ambientação',
    'Luminária de Mesa Articulada Nordic Wood - Design Minimalista em Madeira e Metal',
    'Harmonize funcionalidade e estética no seu espaço de trabalho ou leitura com a Luminária Nordic Wood. Com estrutura em madeira maciça reflorestada e cúpula metálica fosca com articulação precisa, proporciona iluminação direcionada e aconchegante para ambientes produtivos e contemporâneos.',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = 'Casa%'
);

-- 5. Fallback Global / Coringa
INSERT INTO dbo.CategorySeoGuidelines (
    TenantId, CategoryPattern, MandatoryKeywords, RecommendedTone,
    FewShotExampleTitle, FewShotExampleDescription, IsActive
) 
SELECT 
    NULL,
    '%',
    '["qualidade garantida", "pronta entrega", "especificações", "satisfação", "garantia"]',
    'Persuasivo, técnico e focado em benefícios, diferenciais e confiança',
    'Produto Premium Alta Qualidade - Garantia e Pronta Entrega',
    'Descubra a combinação perfeita de desempenho, durabilidade e confiabilidade. Desenvolvido sob rígidos padrões de controle de qualidade, oferece tecnologia de ponta e acabamento superior para suprir suas exigências diárias com excelência e tranquilidade comprovada.',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.CategorySeoGuidelines WHERE TenantId IS NULL AND CategoryPattern = '%'
);
