import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { HomePage } from '@/features/home';
import { AuthPage } from '@/features/auth';
import { LiveDemoPage } from '@/features/live-demo';
import { CatalogHubPage } from '@/features/catalog';
import { SubscriptionPage } from '@/features/subscription';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rota Pública de Autenticação */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Rotas Protegidas com Layout Principal */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/demo" element={<LiveDemoPage />} />
        <Route path="/catalog" element={<CatalogHubPage />} />
        <Route path="/billing" element={<SubscriptionPage />} />
        <Route path="/subscriptions" element={<SubscriptionPage />} />
        <Route path="/plans" element={<SubscriptionPage />} />
        <Route path="/checkout" element={<SubscriptionPage />} />
        <Route path="/products" element={<Navigate to="/catalog" replace />} />

        <Route path="/credentials" element={<Navigate to="/catalog" replace />} />
      </Route>

      {/* Rota Fallback para URLs desconhecidas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
