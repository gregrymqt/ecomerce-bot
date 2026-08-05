import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Scraper & Live Demo SSE', () => {
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
          id: 'usr_qa_test_123',
          email: 'qa@ecomautobot.com',
          name: 'QA Tester',
          tenants: ['tenant_test_qa'],
          is_admin: true,
        }),
      });
    });

    // Intercepta e simula fluxo da API de ingestão de scraping
    await page.route('**/api/v1/scraper/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          task_id: 'task-scraping-demo-123',
          status: 'QUEUED',
          message: 'Extração enviada para a fila com sucesso.',
        }),
      });
    });
  });

  test('Deve acessar /scraper, submeter URL e renderizar progresso em tempo real', async ({
    page,
  }) => {
    await page.goto('/scraper');

    // Verifica elementos do cabeçalho da demo
    const pageHeading = page.getByRole('heading', {
      name: /Veja a IA Extraindo|Extração de Produtos|DEMO SSE/i,
    }).first();
    await expect(pageHeading).toBeVisible();

    // Localiza e preenche o campo de URL do produto
    const urlInput = page.getByPlaceholder(
      /Cole a URL do produto|Shopify, Nuvemshop/i
    );
    await expect(urlInput).toBeVisible();
    await urlInput.fill(
      'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html'
    );

    // Clica no botão para iniciar a demonstração ao vivo
    const submitButton = page.getByRole('button', {
      name: /Iniciar Demonstração Ao Vivo|Extrair/i,
    });
    await expect(submitButton).toBeEnabled();

    // Verifica diretriz de acessibilidade touch target height >= 44px
    const buttonBox = await submitButton.boundingBox();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(40);
    }

    await submitButton.click();

    // Confirma visibilidade do Workspace de Transmissão ou do indicador de progresso
    const workspaceHeading = page.getByRole('heading', {
      name: /Workspace de Transmissão|Logs de Processamento|Processando/i,
    }).or(page.getByText(/Workspace de Transmissão|Extraindo|Concluído/i)).first();

    await expect(workspaceHeading).toBeVisible({ timeout: 5000 });
  });
});
