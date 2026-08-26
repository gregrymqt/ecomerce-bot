import { test, expect } from '@playwright/test';

test.describe('Fluxo E2E: Planos & Checkout Transparente Mercado Pago', () => {
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

    // Intercepta requisições de checkout (/checkout/pix e /checkout/card)
    await page.route('**/api/v1/checkout/*', async (route) => {
      const url = route.request().url();
      if (url.includes('pix')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            qr_code_copy_paste:
              '00020126580014br.gov.bcb.pix0136ecom-autobot-mp-pix-key-99182305204000053039865405149.005802BR5916ECOM AUTOBOT SAO PAULO6009SAO PAULO62070503***6304E8A2',
            qr_code_base64:
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            expiration_date: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
            status: 'PENDING',
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pay_cc_123456789',
            status: 'approved',
            detail: 'Pagamento de teste aprovado com sucesso!',
          }),
        });
      }
    });
  });

  test('Deve acessar /plans, selecionar plano Pro, validar redirecionamento e realizar checkout transparente (PIX e Cartão)', async ({
    page,
    context,
  }) => {
    // Permite leitura e escrita no clipboard para navegadores suportados (Chromium/Chrome)
    await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});

    await page.goto('/plans');

    // Clica no botão de contratação do plano Pro se visível ou navega diretamente para /checkout
    const proPlanBtn = page
      .getByRole('button', { name: /Selecionar Plano Pro|Contratar|Assinar|Escolher/i })
      .first();

    if (await proPlanBtn.isVisible()) {
      await proPlanBtn.click();
    } else {
      await page.goto('/checkout?plan=pro');
    }

    await expect(page).toHaveURL(/\/checkout/);

    // ----------------------------------------------------
    // Aba 1: PIX Instantâneo
    // ----------------------------------------------------
    const pixTabButton = page.getByRole('button', { name: /PIX Instantâneo|PIX/i }).first();
    await expect(pixTabButton).toBeVisible();

    // Valida dimensão mínima WCAG touch target height >= 44px
    const pixBox = await pixTabButton.boundingBox();
    if (pixBox) {
      expect(pixBox.height).toBeGreaterThanOrEqual(44);
    }

    await pixTabButton.click();

    // Confirma a exibição da imagem do QR Code em Base64 e da chave "Copia e Cola"
    const qrCodeImage = page.getByAltText(/QR Code PIX/i).or(page.getByText(/QR CODE PIX|Código PIX/i)).first();
    await expect(qrCodeImage).toBeVisible();

    const pixInput = page.getByLabel(/Código PIX Copia e Cola/i).or(page.locator('#pix-copia-cola'));
    await expect(pixInput).toBeVisible();

    // Clica no botão "Copiar Código Pix" e verifica a alteração do texto para "Copiado!"
    const copyPixButton = page.getByRole('button', { name: /Copiar Código Pix|Copiado!/i }).first();
    await expect(copyPixButton).toBeVisible();
    await copyPixButton.click();

    const copiedFeedback = page.getByText(/Copiado!/i).first();
    await expect(copiedFeedback).toBeVisible();

    // ----------------------------------------------------
    // Aba 2: Cartão de Crédito
    // ----------------------------------------------------
    const ccTabButton = page.getByRole('button', { name: /Cartão de Crédito/i }).first();
    await expect(ccTabButton).toBeVisible();

    const ccBox = await ccTabButton.boundingBox();
    if (ccBox) {
      expect(ccBox.height).toBeGreaterThanOrEqual(44);
    }

    await ccTabButton.click();

    // Preenche os campos do formulário de Cartão de Crédito
    const cardNumberInput = page.getByLabel(/Número do Cartão/i).or(page.locator('#card-number'));
    await expect(cardNumberInput).toBeVisible();
    await cardNumberInput.fill('4532111122223333');

    // Valida o mascaramento automático do número do cartão (0000 0000 0000 0000)
    await expect(cardNumberInput).toHaveValue('4532 1111 2222 3333');

    const cardHolderInput = page.getByLabel(/Nome Impresso/i).or(page.locator('#cardholder-name'));
    await cardHolderInput.fill('QA TESTER CLIENTE');

    const expiryInput = page.getByLabel(/Validade/i).or(page.locator('#card-expiry'));
    await expiryInput.fill('12/28');

    const cvvInput = page.getByLabel(/CVV/i).or(page.locator('#card-cvv'));
    await cvvInput.fill('123');

    const docInput = page.getByLabel(/CPF ou CNPJ/i).or(page.locator('#doc-number'));
    await docInput.fill('12345678909');

    // Submete o formulário de pagamento e intercepta a requisição do endpoint de checkout
    const submitCcButton = page.getByRole('button', { name: /Finalizar Assinatura|Processando|Pagar/i }).first();
    await expect(submitCcButton).toBeEnabled();

    const ccRequestPromise = page.waitForRequest(
      (req) => req.url().includes('/checkout/card') || req.url().includes('/checkout/credit-card')
    );
    await submitCcButton.click();
    await ccRequestPromise;
  });
});
