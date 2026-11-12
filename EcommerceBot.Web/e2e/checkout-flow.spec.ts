import { test, expect } from '@playwright/test';
import { E2E_TENANT_ID, setupAuthenticatedSession } from './helpers/authMock.js';

test.describe('Fluxo E2E: Carteira & Checkout Transparente Mercado Pago', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page);

    await page.route('**/api/v1/wallet/credit-packages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'pkg-pro-500',
            name: 'Pacote Crescimento 500',
            description: '500 créditos perpétuos de enriquecimento IA',
            credits: 500,
            price_brl: 149,
            is_popular: true,
            discount_badge: 'Mais Popular',
          },
        ]),
      });
    });

    await page.route('**/api/v1/wallet/statement*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], total_count: 0, page: 1, page_size: 20 }),
      });
    });

    await page.route('**/api/v1/billing/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'bill-001',
          tenant_id: E2E_TENANT_ID,
          document_type: 'CPF',
          document_number: '52998224725',
          legal_name: 'Rodrigo Teste E2E',
          email: 'admin@ecommerce.com',
          zip_code: '01310100',
          street_name: 'Av Paulista',
          street_number: '1000',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          federal_unit: 'SP',
        }),
      });
    });

    await page.route('**/api/v1/wallet/recharge', async (route) => {
      const payload = route.request().postDataJSON() as { payment_method?: string } | null;
      if (payload?.payment_method === 'pix') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            order_id: 'ord-pix-123',
            payment_id: 'pay-pix-123',
            status: 'pending',
            pix_qr_code:
              '00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2',
            pix_qr_code_base64:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          order_id: 'ord-cc-123',
          payment_id: 'pay-cc-123',
          status: 'approved',
          detail: 'Pagamento aprovado com sucesso.',
        }),
      });
    });
  });

  test('Deve acessar /wallet, abrir checkout do pacote e validar abas PIX e Cartão de Crédito', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    await page.goto('/wallet');
    await expect(page.getByRole('heading', { name: /Carteira & Créditos de IA/i })).toBeVisible();

    const buyButton = page.getByRole('button', { name: /Comprar Pacote/i }).first();
    await expect(buyButton).toBeVisible();

    const buyBox = await buyButton.boundingBox();
    if (buyBox) {
      expect(buyBox.height).toBeGreaterThanOrEqual(44);
    }

    const pixRechargePromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/wallet/recharge') && req.method() === 'POST'
    );
    await buyButton.click();
    await pixRechargePromise;

    await expect(page.getByRole('heading', { name: /Checkout Seguro Mercado Pago/i })).toBeVisible();

    const pixInput = page.locator('#pix-copia-cola').or(page.getByLabel(/Código PIX/i)).first();
    await expect(pixInput).toBeVisible();

    const copyPixButton = page.getByRole('button', { name: /Copiar/i }).first();
    await expect(copyPixButton).toBeVisible();
    await copyPixButton.click();

    const ccTabButton = page.getByRole('button', { name: /Cartão de Crédito/i }).first();
    await expect(ccTabButton).toBeVisible();
    const ccBox = await ccTabButton.boundingBox();
    if (ccBox) {
      expect(ccBox.height).toBeGreaterThanOrEqual(44);
    }

    await ccTabButton.click();

    const cardNumberInput = page.locator('#card-number');
    await expect(cardNumberInput).toBeVisible();
    await cardNumberInput.fill('4532111122223333');
    await expect(cardNumberInput).toHaveValue('4532 1111 2222 3333');

    await page.locator('#cardholder-name').fill('QA TESTER CLIENTE');
    await page.locator('#card-expiry').fill('12/28');
    await page.locator('#card-cvv').fill('123');
    await page.locator('#doc-number').fill('52998224725');

    const submitCcButton = page.getByRole('button', { name: /Pagar R\$|Finalizar/i }).first();
    await expect(submitCcButton).toBeEnabled();

    const ccRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/api/v1/wallet/recharge') && req.method() === 'POST'
    );
    await submitCcButton.click();
    await ccRequestPromise;
  });
});
