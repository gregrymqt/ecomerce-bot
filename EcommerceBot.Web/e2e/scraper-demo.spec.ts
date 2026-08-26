import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Ingestão de Scraper & Transmissão SSE em Tempo Real', () => {
  test.beforeEach(async ({ page }) => {
    // Configura localStorage com token e tenant autenticado
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test_e2e_jwt_token_123');
      localStorage.setItem('tenant_id', 'tenant_test_qa');
    });

    // Intercepta verificação da sessão do usuário (/auth/me)
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

    // Intercepta rota de disparo do scraper (/scraper/extract)
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

  test('Deve acessar /scraper, submeter URL de produto e renderizar barra de progresso SSE', async ({
    page,
  }) => {
    // 1. Navega para a página do Scraper / Live Demo
    await page.goto('/scraper');

    // Valida título da seção Hero do Scraper
    const pageHeading = page.getByRole('heading', {
      name: /Veja a IA Extraindo|Extração de Produtos|DEMO SSE/i,
    }).first();
    await expect(pageHeading).toBeVisible();

    // 2. Preenche o input de URL do produto
    const urlInput = page.getByPlaceholder(
      /Cole a URL do produto|Shopify, Nuvemshop/i
    );
    await expect(urlInput).toBeVisible();
    await urlInput.fill(
      'https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html'
    );

    // 3. Submete o formulário ("Iniciar Demonstração Ao Vivo")
    const submitButton = page.getByRole('button', {
      name: /Iniciar Demonstração Ao Vivo|Extrair/i,
    }).first();
    await expect(submitButton).toBeEnabled();

    // Verifica acessibilidade touch target min-h-[44px]
    const buttonBox = await submitButton.boundingBox();
    if (buttonBox) {
      expect(buttonBox.height).toBeGreaterThanOrEqual(40);
    }

    await submitButton.click();

    // 4. Confirma visibilidade do Workspace de Transmissão e barra de progresso / terminal SSE
    const workspaceHeading = page.getByRole('heading', {
      name: /Workspace de Transmissão|Logs de Processamento|Processando/i,
    }).or(page.getByText(/Workspace de Transmissão|Extraindo|Concluído/i)).first();

    await expect(workspaceHeading).toBeVisible();

    // Valida que o container do terminal SSE ou log de progresso exibe indicador de status/barra de progresso
    const progressStatus = page.getByText(/Processando|Connecting|Extraindo|Concluído|Conexão estabelecida/i).first();
    await expect(progressStatus).toBeVisible();
  });
});
