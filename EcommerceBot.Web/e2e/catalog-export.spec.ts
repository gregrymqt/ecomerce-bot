import { test, expect } from '@playwright/test';
import { E2E_TENANT_ID, setupAuthenticatedSession } from './helpers/authMock.js';

test.describe('Fluxo E2E: Central de Catálogo & Exportação em Lote', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/v1/products*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          items: [
            {
              id: 'prod-001',
              tenant_id: E2E_TENANT_ID,
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
              tenant_id: E2E_TENANT_ID,
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
  });

  test('Deve acessar /catalog, aplicar filtro Processados, validar tabela e baixar exportação em lote', async ({
    page,
  }) => {
    await page.goto('/catalog');

    const catalogHeading = page.getByRole('heading', { name: /Central de Catálogo/i }).first();
    await expect(catalogHeading).toBeVisible();

    const processedFilterBtn = page.getByRole('button', { name: /Processados/i }).first();
    await expect(processedFilterBtn).toBeVisible();

    const filterBox = await processedFilterBtn.boundingBox();
    if (filterBox) {
      expect(filterBox.height).toBeGreaterThanOrEqual(44);
    }

    await processedFilterBtn.click();

    await expect(page.getByText(/SKU-E2E-PROCESSED-01|Camisa Polo Slim Fit/i).first()).toBeVisible();

    const exportButton = page.getByRole('button', { name: /Exportar Lote/i }).first();
    await expect(exportButton).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await exportButton.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/catalogo-export-.*\.json/i);

    const downloadPath = await download.path();
    if (downloadPath) {
      const fs = await import('node:fs');
      const content = fs.readFileSync(downloadPath, 'utf-8');
      expect(content).toContain('SKU-E2E-PROCESSED-01');
    }
  });
});
