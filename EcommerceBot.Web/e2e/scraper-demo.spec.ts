import { test, expect } from '@playwright/test';
import { setupAuthenticatedSession } from './helpers/authMock.js';

test.describe('Fluxo E2E: Live Demo de Scraping & Transmissão SSE em Tempo Real', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/v1/system/demo', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'enviado_para_fila' }),
        });
      }
    });

    await page.route('**/api/v1/system/demo/stream*', async (route) => {
      const ssePayload = JSON.stringify({
        type: 'product_processed',
        sku: 'demo_e2e_01',
        status: 'PROCESSED',
        isFallback: false,
        progress: 100,
        log: {
          id: 'log-e2e-1',
          timestamp: '10:00:00',
          level: 'SUCCESS',
          message: 'Catálogo enriquecido com sucesso via IA!',
        },
        result: {
          titleOriginal: 'A Light in the Attic',
          titleMagnetic: 'Livro Colecionador: A Light in the Attic - Edição Especial',
          tone: 'demo',
          category: 'Livros',
          seoScore: 95,
          bulletPoints: ['Edição ilustrada clássica', 'Entrega rápida para todo o Brasil'],
          price: 'R$ 51,77',
          imageUrl: 'https://books.toscrape.com/media/cache/fe/72/fe72f0532301ec28892ae79a629a293c.jpg',
          rawJson: { sku: 'demo_e2e_01' },
        },
      });

      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: `data: {"type":"connected"}\n\ndata: ${ssePayload}\n\n`,
      });
    });
  });

  test('Deve acessar /demo, submeter URL pública e receber evento SSE real até o preview final', async ({
    page,
  }) => {
    await page.goto('/demo');

    const pageHeading = page.getByRole('heading', { name: /Veja a IA Extraindo/i }).first();
    await expect(pageHeading).toBeVisible();

    const urlInput = page.getByPlaceholder(/Cole a URL do produto/i);
    await expect(urlInput).toBeVisible();
    await urlInput.fill('https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html');

    const submitButton = page.getByRole('button', { name: /Iniciar Demonstração Ao Vivo/i }).first();
    await expect(submitButton).toBeEnabled();

    const buttonBox = await submitButton.boundingBox();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(44);
    }

    const demoRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/system/demo') && req.method() === 'POST'
    );
    await submitButton.click();
    await demoRequestPromise;

    await expect(page.getByRole('heading', { name: /Workspace de Transmissão/i })).toBeVisible();
    await expect(
      page.getByText(/Livro Colecionador: A Light in the Attic|Catálogo enriquecido com sucesso/i).first()
    ).toBeVisible();
  });
});
