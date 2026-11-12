import type { Page } from '@playwright/test';

export const E2E_TENANT_ID = '272eeeae-1957-401a-88ce-70b55f282785';
export const E2E_AUTH_TOKEN = 'test_e2e_jwt_token_123';

/**
 * Populates localStorage with canonical auth keys and intercepts common layout/session APIs.
 */
export async function setupAuthenticatedSession(page: Page): Promise<void> {
  await page.addInitScript(
    ({ token, tenantId }) => {
      localStorage.setItem('app_auth_token', JSON.stringify(token));
      localStorage.setItem('app_active_tenant_id', JSON.stringify(tenantId));
    },
    { token: E2E_AUTH_TOKEN, tenantId: E2E_TENANT_ID }
  );

  await page.route('**/api/v1/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'usr_e2e_qa_123',
        email: 'admin@ecommerce.com',
        name: 'Engenheiro QA E2E',
        role: 'owner',
        tenants: [E2E_TENANT_ID],
        is_admin: true,
      }),
    });
  });

  await page.route('**/api/v1/tenant/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: E2E_TENANT_ID,
        name: 'Loja Teste E2E',
        plan_tier: 'PRO',
      }),
    });
  });

  await page.route('**/api/v1/wallet/balance', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        balance_credits: 120,
        tenant_id: E2E_TENANT_ID,
      }),
    });
  });
}
