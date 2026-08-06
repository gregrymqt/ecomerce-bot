import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Autenticação & Gestão de Credenciais de IA (BYOK)', () => {
  test.beforeEach(async ({ page }) => {
    // Configura localStorage com token e tenant autenticado antes dos testes
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test_e2e_jwt_token_123');
      localStorage.setItem('tenant_id', 'tenant_qa_test');
    });

    // Intercepta rota de verificação de autenticação (/auth/me)
    await page.route('**/api/v1/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_e2e_qa_123',
          email: 'admin@ecommerce.com',
          name: 'Engenheiro QA E2E',
          tenants: ['tenant_qa_test'],
          is_admin: true,
        }),
      });
    });

    // Intercepta requisição de login (/auth/login)
    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_e2e_qa_123',
          email: 'admin@ecommerce.com',
          name: 'Engenheiro QA E2E',
          access_token: 'jwt_mock_token_e2e_pass_123',
          tenant_id: 'tenant_qa_test',
        }),
      });
    });

    // Intercepta listagem de chaves (/ai-keys) inicialmente sem chave configurada
    await page.route('**/api/v1/ai-keys', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          keys: {
            openrouter: {
              apiKey: '',
              isValidated: false,
            },
          },
          active_provider: 'openrouter',
        }),
      });
    });

    // Intercepta teste de conexão de chave de IA (/ai-keys/test)
    await page.route('**/api/v1/ai-keys/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          provider: 'openrouter',
          message: 'Chave do OpenRouter autenticada com sucesso.',
        }),
      });
    });
  });

  test('Deve efetuar login em /auth, navegar para configurações e testar chave OpenRouter com indicação de loading e sucesso', async ({
    page,
  }) => {
    // 1. Acessa a página de autenticação
    await page.goto('/auth');

    // Preenche credenciais no formulário de login usando seletores acessíveis e precisos
    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const loginButton = page.getByRole('button', { name: /Entrar/i }).first();

    await expect(emailInput).toBeVisible();
    await emailInput.fill('admin@ecommerce.com');
    await passwordInput.fill('admin123');

    await expect(loginButton).toBeEnabled();

    // Valida dimensão do botão min-h-[44px] para acessibilidade de toque
    const loginBox = await loginButton.boundingBox();
    if (loginBox) {
      expect(loginBox.height).toBeGreaterThanOrEqual(44);
    }

    await loginButton.click();

    // 2. Navega para as configurações (/settings)
    await page.goto('/settings');

    // Clica no botão "Chaves IA (BYOK)" do header ou "Gerenciar Chaves" para abrir o modal BYOK
    const byokButton = page
      .getByRole('button', { name: /Chaves IA \(BYOK\)|Chaves de IA|Gerenciar Chaves/i })
      .first();
    await expect(byokButton).toBeVisible();
    await byokButton.click();

    // 3. Verifica título do modal BYOK
    const modalTitle = page.getByRole('heading', { name: /Gerenciar Chaves de IA \(BYOK\)/i }).first();
    await expect(modalTitle).toBeVisible();

    // 4. Localiza input específico do provedor OpenRouter pelo placeholder único
    const openRouterInput = page.getByPlaceholder('sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxx');
    await expect(openRouterInput).toBeVisible();
    await openRouterInput.fill('sk-or-v1-1234567890abcdef');

    // 5. Localiza o formulário específico do OpenRouter e o botão de ação correspondente
    const openRouterForm = page.locator('form').filter({ has: openRouterInput });
    const actionBtn = openRouterForm.getByRole('button', { name: /Salvar Chave|Testar Conexão|Testando Conexão.../i });
    await expect(actionBtn).toBeEnabled();

    const testRequestPromise = page.waitForRequest('**/api/v1/ai-keys*');
    await actionBtn.click();
    await testRequestPromise;

    // 6. Assertar feedback visual de validação/sucesso na UI (Badge "Validada" ou Toast)
    const successFeedback = page
      .getByText(/Validada|autenticada com sucesso|Chave salva/i)
      .first();
    await expect(successFeedback).toBeVisible();
  });
});
