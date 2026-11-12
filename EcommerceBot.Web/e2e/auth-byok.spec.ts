import { test, expect } from '@playwright/test';
import { E2E_TENANT_ID, setupAuthenticatedSession } from './helpers/authMock.js';

test.describe('Fluxo E2E: Autenticação & Configurações de IA do Tenant', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_e2e_qa_123',
          email: 'admin@ecommerce.com',
          name: 'Engenheiro QA E2E',
          role: 'owner',
          access_token: 'jwt_mock_token_e2e_pass_123',
          tenant_id: E2E_TENANT_ID,
          tenants: [E2E_TENANT_ID],
        }),
      });
    });

    await page.route('**/api/v1/settings', async (route) => {
      const method = route.request().method();
      if (method === 'PUT') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            ai_settings: {
              target_language: 'pt-BR',
              tone_of_voice: 'technical',
              custom_tags: ['seo', 'alta-conversao'],
            },
            pricing_settings: {
              markup_percentage: 25,
              rounding_rule: 'ENDING_99',
            },
            store_profile: {
              store_name: 'Loja Teste E2E',
              admin_email: 'admin@ecommerce.com',
            },
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ai_settings: {
            target_language: 'pt-BR',
            tone_of_voice: 'persuasive',
            custom_tags: ['seo'],
          },
          pricing_settings: {
            markup_percentage: 15,
            rounding_rule: 'ENDING_99',
          },
          store_profile: {
            store_name: 'Loja Teste E2E',
            admin_email: 'admin@ecommerce.com',
          },
        }),
      });
    });
  });

  test('Deve autenticar em /auth, navegar para /settings e salvar regras de IA via PUT /api/v1/settings', async ({
    page,
  }) => {
    await page.goto('/auth');

    const emailInput = page.locator('input[name="email"]');
    const passwordInput = page.locator('input[name="password"]');
    const loginButton = page.getByRole('button', { name: /Entrar na Plataforma|Entrar/i }).first();

    await expect(emailInput).toBeVisible();
    await emailInput.fill('admin@ecommerce.com');
    await passwordInput.fill('SenhaForte@2026!');
    await expect(loginButton).toBeEnabled();

    const loginBox = await loginButton.boundingBox();
    if (loginBox) {
      expect(loginBox.height).toBeGreaterThanOrEqual(44);
    }

    const loginPromise = page.waitForRequest((req) => req.url().includes('/api/v1/auth/login'));
    await loginButton.click();
    await loginPromise;

    await page.goto('/settings');

    const settingsHeading = page.getByRole('heading', { name: /Configurações & Preferências/i }).first();
    await expect(settingsHeading).toBeVisible();

    const technicalToneBtn = page.getByRole('button', { name: /Técnico & Factual/i }).first();
    if (await technicalToneBtn.isVisible().catch(() => false)) {
      await technicalToneBtn.click();
    }

    const saveButton = page.getByRole('button', { name: /Salvar Configurações/i }).first();
    await expect(saveButton).toBeEnabled();

    const saveBox = await saveButton.boundingBox();
    if (saveBox) {
      expect(saveBox.height).toBeGreaterThanOrEqual(44);
    }

    const savePromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/settings') && req.method() === 'PUT'
    );
    await saveButton.click();
    await savePromise;

    await expect(page.getByText(/sucesso|atualizadas|salvas/i).first()).toBeVisible();
  });
});
