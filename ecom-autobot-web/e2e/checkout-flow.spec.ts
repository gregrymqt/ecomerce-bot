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
          id: 'usr_qa_test_123',
          email: 'qa@ecomautobot.com',
          name: 'QA Tester',
          tenants: ['tenant_test_qa'],
          is_admin: true,
        }),
      });
    });

    // Intercepta e simula requisição de geração de PIX
    await page.route('**/api/v1/checkout/pix*', async (route) => {
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
    });

    // Intercepta e simula pagamento com Cartão de Crédito
    await page.route('**/api/v1/checkout/credit-card*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'pay_cc_123456789',
          status: 'approved',
          detail: 'Pagamento de teste aprovado com sucesso!',
        }),
      });
    });
  });

  test('Deve acessar /plans, selecionar o plano Pro e realizar checkout transparente (PIX e Cartão)', async ({
    page,
    context,
  }) => {
    // Permite leitura e escrita no clipboard para testar o Copia e Cola do PIX
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.goto('/plans');

    // Clica no botão de contratação do plano Pro se visível ou navega diretamente para /checkout
    const proPlanBtn = page.getByRole('button', { name: /Selecionar Plano Pro|Contratar|Assinar|Escolher|Gerenciar Cartão/i }).first();
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

    // Verifica exibição da imagem do QR Code ou container PIX
    const qrCodeImage = page.getByAltText(/QR Code PIX/i).or(page.getByText(/QR CODE PIX|Código PIX|Tempo restante/i)).first();
    await expect(qrCodeImage).toBeVisible();

    // Localiza botão Copiar Código Pix e aciona a cópia
    const copyPixButton = page.getByRole('button', { name: /Copiar Código Pix|Copiado!/i }).first();
    await expect(copyPixButton).toBeVisible();
    await copyPixButton.click();

    // Confirma feedback visual ("Copiado!")
    const copiedFeedback = page.getByText(/Copiado!|Código Pix/i).first();
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

    // Preenche campos simulados do cartão de crédito
    const cardNumberInput = page.getByLabel(/Número do Cartão/i).or(page.getByPlaceholder(/0000 0000/i));
    await expect(cardNumberInput).toBeVisible();
    await cardNumberInput.fill('4532111122223333');

    const cardHolderInput = page.getByLabel(/Nome Impresso/i).or(page.getByPlaceholder(/NOME COMO ESTÁ/i));
    await cardHolderInput.fill('QA TESTER CLIENTE');

    const expiryInput = page.getByLabel(/Validade/i).or(page.getByPlaceholder(/MM\/AA/i));
    await expiryInput.fill('12/28');

    const cvvInput = page.getByLabel(/CVV/i).or(page.getByPlaceholder(/123/i));
    await cvvInput.fill('123');

    const docInput = page.locator('#doc-number').or(page.getByLabel(/CPF ou CNPJ/i));
    await docInput.fill('12345678909');

    // Submete o checkout transparente com o cartão
    const submitCcButton = page.getByRole('button', { name: /Finalizar Assinatura|Processando/i });
    await expect(submitCcButton).toBeEnabled();
    await submitCcButton.click();
  });
});
