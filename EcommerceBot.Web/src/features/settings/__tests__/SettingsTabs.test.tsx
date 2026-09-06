/**
 * src/features/settings/__tests__/SettingsTabs.test.tsx
 *
 * Testes unitários para resiliência dos componentes StoreProfileTab e BillingProfileTab.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StoreProfileTab } from '../components/StoreProfileTab';
import { BillingProfileTab } from '../components/BillingProfileTab';

describe('Settings Tabs Defensive Rendering', () => {
  it('StoreProfileTab não deve quebrar quando data for undefined', () => {
    render(<StoreProfileTab data={undefined} onChange={vi.fn()} />);

    expect(screen.getByText('Perfil da Loja & Tenant')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome da Loja')).toHaveValue('Minha Loja E-Commerce');
  });

  it('BillingProfileTab não deve quebrar quando data for undefined', () => {
    render(<BillingProfileTab data={undefined} onChange={vi.fn()} />);

    expect(screen.getByText('Dados Fiscais & Cobrança')).toBeInTheDocument();
    expect(screen.getByLabelText('Razão Social / Nome Completo')).toHaveValue(
      'E-Commerce Bot Tech Ltda'
    );
  });
});
