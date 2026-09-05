/**
 * src/layouts/DynamicRoleLayout.tsx
 *
 * Shell de Layout Adaptativo baseado em Roles e Entitlements.
 * Renderiza dinamicamente AdminLayout, MerchantLayout ou MemberLayout
 * de acordo com o perfil do usuário logado, mantendo a integridade da sidebar
 * em páginas compartilhadas (/wallet, /settings, /catalog).
 */

import React from 'react';
import { AdminLayout } from './AdminLayout';
import { MerchantLayout } from './MerchantLayout';
import { MemberLayout } from './MemberLayout';
import { useRoleLayout } from './hooks/useRoleLayout';
import { PageLoader } from '@/components/ui/feedback/PageLoader';

export const DynamicRoleLayout: React.FC = () => {
  const { resolvedLayout, isLoading } = useRoleLayout();

  if (isLoading) {
    return <PageLoader />;
  }

  switch (resolvedLayout) {
    case 'admin':
      return <AdminLayout />;
    case 'merchant':
      return <MerchantLayout />;
    case 'member':
    default:
      return <MemberLayout />;
  }
};

export default DynamicRoleLayout;
