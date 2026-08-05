import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthPage, AdminRouteGuard } from '@/features/auth';
import { LiveDemoPage } from '@/features/live-demo';
import { CatalogPage } from '@/features/catalog';
import { SubscriptionPage } from '@/features/subscription';
import { AdminPlansPage } from '@/features/plans';
import { CheckoutPage } from '@/features/checkout';
import { IntegrationsPage } from '@/features/integrations';
import { DashboardPage } from '@/features/dashboard';
import { SettingsPage } from '@/features/settings';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rota Pública de Autenticação */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Rota de Checkout Transparente Standalone */}
      <Route path="/checkout" element={<CheckoutPage />} />

      {/* Rotas Protegidas com Layout Principal */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/home" element={<DashboardPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/demo" element={<LiveDemoPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route path="/integrations" element={<IntegrationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/billing" element={<SubscriptionPage />} />
        <Route path="/subscriptions" element={<SubscriptionPage />} />
        <Route path="/plans" element={<SubscriptionPage />} />
        
        {/* Rotas de Administração Protegidas por AdminRouteGuard */}
        <Route
          path="/admin/plans"
          element={
            <AdminRouteGuard>
              <AdminPlansPage />
            </AdminRouteGuard>
          }
        />
        <Route
          path="/plans/admin"
          element={
            <AdminRouteGuard>
              <AdminPlansPage />
            </AdminRouteGuard>
          }
        />
        <Route path="/products" element={<Navigate to="/catalog" replace />} />

        <Route path="/credentials" element={<Navigate to="/integrations" replace />} />
      </Route>

      {/* Rota Fallback para URLs desconhecidas */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
