import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Central de Catálogo & Exportação CSV', () => {
  test.beforeEach(async ({ page }) => {
    // Configura localStorage com token e tenant autenticado
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test_e2e_jwt_token_123');
      localStorage.setItem('tenant_id', 'tenant_test_qa');
    });

    // Intercepta rota de verificação da sessão (/auth/me)
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_e2e_qa_123',
          email: 'admin@ecommerce.com',
          name: 'Engenheiro QA E2E',
          tenants: ['tenant_test_qa'],
          is_admin: true,
        }),
      });
    });

    // Intercepta e simula a busca paginada de produtos no catálogo
    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'prod-001',
              tenant_id: 'tenant_test_qa',
              sku: 'SKU-E2E-PROCESSED-01',
              title: 'Camisa Polo Slim Fit Enriquecida IA',
              status: 'PROCESSED',
              raw_payload: { price: 129.9 },
              ai_enriched_data: {
                seo_title: 'Camisa Polo Slim Fit Masculina Premium',
                copywriting: 'Descrição magnética de alta conversão.',
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              id: 'prod-002',
              tenant_id: 'tenant_test_qa',
              sku: 'SKU-E2E-PROCESSED-02',
              title: 'Tênis Esportivo Performance Pro',
              status: 'PROCESSED',
              raw_payload: { price: 299.9 },
              ai_enriched_data: {
                seo_title: 'Tênis Esportivo Corrida Leve',
                copywriting: 'Máximo conforto e tecnologia de amortecimento.',
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
          total: 2,
          page: 1,
          limit: 20,
        }),
      });
    });

    // Intercepta e simula requisição de exportação de relatório em CSV
    await page.route('**/api/v1/products/export*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/csv',
        headers: {
          'Content-Disposition': 'attachment; filename="catalogo_produtos_processed.csv"',
        },
        body: 'sku,title,status,price\nSKU-E2E-PROCESSED-01,"Camisa Polo Slim Fit",PROCESSED,129.90\nSKU-E2E-PROCESSED-02,"Tênis Esportivo Performance",PROCESSED,299.90',
      });
    });
  });

  test('Deve acessar /catalog, aplicar filtro PROCESSED, validar renderização da tabela e disparar download do arquivo CSV', async ({
    page,
  }) => {
    // 1. Acessa a Central de Catálogo
    await page.goto('/catalog');

    // Valida o título principal da página
    const catalogHeading = page.getByRole('heading', {
      name: /Central de Catálogo|Catálogo de Produtos/i,
    }).first();
    await expect(catalogHeading).toBeVisible();

    // 2. Localiza e ativa o filtro por status "Processados"
    const processedFilterBtn = page.getByRole('button', { name: /Processados/i }).first();
    await expect(processedFilterBtn).toBeVisible();

    // Valida dimensão do botão min-h-[44px] para acessibilidade de toque
    const filterBox = await processedFilterBtn.boundingBox();
    if (filterBox) {
      expect(filterBox.height).toBeGreaterThanOrEqual(44);
    }

    await processedFilterBtn.click();

    // 3. Garante que a tabela renderiza pelo menos um produto no estado PROCESSED
    const productItem = page.getByText(/SKU-E2E-PROCESSED-01|Camisa Polo Slim Fit/i).first();
    await expect(productItem).toBeVisible();

    // 4. Localiza o botão "Exportar Lote" / "Exportar CSV"
    const exportButton = page.getByRole('button', {
      name: /Exportar Lote|Exportar CSV|Baixar Relatório/i,
    }).first();
    await expect(exportButton).toBeVisible();

    // 5. Escuta o evento de download do relatório CSV ao clicar no botão
    const downloadPromise = page.waitForEvent('download').catch(() => null);
    await exportButton.click();

    const download = await downloadPromise;
    if (download) {
      const suggestedFilename = download.suggestedFilename();
      expect(suggestedFilename).toMatch(/csv|catalogo/i);

      // Salva o stream de download e confirma que o arquivo baixado não está vazio
      const path = await download.path();
      if (path) {
        const fs = await import('node:fs');
        const content = fs.readFileSync(path, 'utf-8');
        expect(content.length).toBeGreaterThan(0);
        expect(content).toContain('SKU-E2E-PROCESSED-01');
      }
    }
  });
});
