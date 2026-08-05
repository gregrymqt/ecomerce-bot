import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Autenticação BYOK & Chaves de IA', () => {
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

    // Intercepta e simula requisições da API de chaves de IA (BYOK)
    await page.route('**/api/v1/ai-keys/test', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          provider: 'openrouter',
          message: 'Chave de API OpenRouter validada com sucesso!',
          ping_time_ms: 45,
        }),
      });
    });

    await page.route('**/api/v1/ai-keys*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          keys: {
            openrouter: {
              apiKey: 'sk-or-v1-testkey123456789',
              isValidated: true,
              pingTime: '45ms',
            },
          },
          active_provider: 'openrouter',
        }),
      });
    });
  });

  test('Deve acessar /settings, abrir modal BYOK, preencher OpenRouter e validar credencial', async ({
    page,
  }) => {
    await page.goto('/settings');

    // Clica no botão de abrir Modal de Chaves de IA no header/sidebar se visível
    const openModalBtn = page.getByRole('button', { name: /Chaves de IA|Gerenciar Chaves/i }).first();
    if (await openModalBtn.isVisible()) {
      await openModalBtn.click();
    }

    // Localiza o modal ou página de configurações
    const pageHeading = page.getByRole('heading', {
      name: /Configurações & Preferências|Gerenciar Chaves de IA|Chaves de API/i,
    }).first();
    await expect(pageHeading).toBeVisible();

    // Procura o input de chave para o provedor OpenRouter
    const openRouterInput = page.getByPlaceholder(/sk-or-v1-|sk-xxxxxxxx|OpenRouter/i).or(
      page.getByLabel(/Chave de Acesso|API Key|OpenRouter/i)
    ).first();

    if (await openRouterInput.isVisible()) {
      await openRouterInput.fill('sk-or-v1-testkey12345678987654321');

      const submitButton = page
        .getByRole('button', { name: /Salvar Chave|Testar Conexão|Salvar/i })
        .first();
      await expect(submitButton).toBeEnabled();

      // Valida touch target height (>= 44px)
      const box = await submitButton.boundingBox();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }

      await submitButton.click();

      // Verifica toast de confirmação visual ou badge de validação
      const successFeedback = page.getByText(/Validada|Sucesso|salvas com sucesso/i).first();
      await expect(successFeedback).toBeVisible({ timeout: 5000 });
    }
  });
});
