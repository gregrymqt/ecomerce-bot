import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { ProtectedRoute, PaidRouteGuard, AdminRouteGuard } from '@/features/auth';
import { PageLoader } from '@/components/ui/feedback/PageLoader';

// Carregamento Sob Demanda das Páginas (Code Splitting / Lazy Loading)
const AuthPage = lazy(() => import('@/features/auth/pages/AuthPage'));
const GoogleCallbackPage = lazy(() => import('@/features/auth/pages/GoogleCallbackPage'));
const CheckoutPage = lazy(() => import('@/features/checkout/pages/CheckoutPage'));
const LiveDemoPage = lazy(() => import('@/features/live-demo/pages/LiveDemoPage'));
const CatalogPage = lazy(() => import('@/features/catalog/pages/CatalogPage'));
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
            {/* Rotas de Degustação / Gratuitas */}
            <Route path="/demo" element={<LiveDemoPage />} />
            <Route path="/scraper" element={<LiveDemoPage />} />
            <Route path="/billing" element={<Navigate to="/checkout" replace />} />
            <Route path="/subscriptions" element={<Navigate to="/checkout" replace />} />
            <Route path="/plans" element={<Navigate to="/checkout" replace />} />
            <Route path="/settings" element={<SettingsPage />} />

            {/* Rotas Protegidas para Usuários Pagantes (Pro / Enterprise) */}
            <Route
              path="/"
              element={
                <PaidRouteGuard featureKey="dashboard">
                  <DashboardPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/home"
              element={
                <PaidRouteGuard featureKey="dashboard">
                  <DashboardPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/dashboard"
              element={
                <PaidRouteGuard featureKey="dashboard">
                  <DashboardPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/catalog"
              element={
                <PaidRouteGuard featureKey="catalog">
                  <CatalogPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/integrations"
              element={
                <PaidRouteGuard featureKey="integrations">
                  <IntegrationsPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/billing/metering"
              element={
                <PaidRouteGuard featureKey="metering">
                  <MeteringDashboardPage />
                </PaidRouteGuard>
              }
            />
            <Route
              path="/metering"
              element={
                <PaidRouteGuard featureKey="metering">
                  <MeteringDashboardPage />
                </PaidRouteGuard>
              }
            />

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
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
