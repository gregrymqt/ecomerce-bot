import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute, AdminRouteGuard } from '@/features/auth';
import { PageLoader } from '@/components/ui/feedback/PageLoader';

// Carregamento Sob Demanda das Páginas (Code Splitting / Lazy Loading)
const AuthPage = lazy(() => import('@/features/auth/pages/AuthPage'));
const GoogleCallbackPage = lazy(() => import('@/features/auth/pages/GoogleCallbackPage'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'));
const LiveDemoPage = lazy(() => import('@/features/live-demo/pages/LiveDemoPage'));
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage'));
const SubscriptionPage = lazy(() => import('@/features/subscription/pages/SubscriptionPage'));
const AdminPlansPage = lazy(() => import('@/features/plans/pages/AdminPlansPage'));
const IntegrationsPage = lazy(() => import('@/features/integrations/pages/IntegrationsPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/pages/DashboardPage'));
const SettingsPage = lazy(() => import('@/features/settings/pages/SettingsPage'));
const MeteringDashboardPage = lazy(() => import('@/features/metering/pages/MeteringDashboardPage'));

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Rota Pública de Autenticação */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />

        {/* Rota de Checkout Transparente Standalone */}
        <Route path="/checkout" element={<CheckoutPage />} />

        {/* Rotas Protegidas com Guarda de Autenticação e Layout Principal */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/home" element={<DashboardPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/demo" element={<LiveDemoPage />} />
            <Route path="/scraper" element={<LiveDemoPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/settings/ai-keys" element={<SettingsPage />} />
            <Route path="/billing" element={<SubscriptionPage />} />
            <Route path="/billing/metering" element={<MeteringDashboardPage />} />
            <Route path="/metering" element={<MeteringDashboardPage />} />
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
        </Route>

        {/* Rota Fallback para URLs desconhecidas */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
