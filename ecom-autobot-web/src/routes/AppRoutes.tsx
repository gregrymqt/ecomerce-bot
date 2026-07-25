import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthPage } from '@/features/auth';
import { LiveDemoPage } from '@/features/live-demo';
import { CatalogHubPage } from '@/features/catalog';
import { SubscriptionPage } from '@/features/subscription';
import { PlansPage } from '@/features/plans';
import { CheckoutPage } from '@/features/checkout';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rota Pública de Autenticação */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Rotas Protegidas com Layout Principal */}
      <Route element={<MainLayout />}>
        <Route path="/demo" element={<LiveDemoPage />} />
        <Route path="/catalog" element={<CatalogHubPage />} />
        <Route path="/subscriptions" element={<SubscriptionPage />} />
        <Route path="/plans" element={<PlansPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/products" element={<Navigate to="/catalog" replace />} />
        <Route path="/credentials" element={<Navigate to="/catalog" replace />} />
        
        {/* Redirecionamento da Raiz para a Central do Catálogo */}
        <Route path="/" element={<Navigate to="/catalog" replace />} />
      </Route>

      {/* Rota Fallback para URLs desconhecidas */}
      <Route path="*" element={<Navigate to="/catalog" replace />} />
    </Routes>
  );
};

export default AppRoutes;
