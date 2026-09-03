import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AdminLayout, MerchantLayout, MemberLayout } from '@/layouts';
import { ProtectedRoute, PaidRouteGuard, AdminRouteGuard, useAuth } from '@/features/auth';
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
const WalletPage = lazy(() => import('@/features/wallet/pages/WalletPage'));
const TrafficAnalyticsPage = lazy(() => import('@/features/analytics/pages/TrafficAnalyticsPage'));
const AdminGrowthPage = lazy(() => import('@/features/admin/pages/AdminGrowthPage'));
const AdminEnterpriseLeadsPage = lazy(() => import('@/features/admin/pages/AdminEnterpriseLeadsPage'));
const AdminAiCapacityPage = lazy(() => import('@/features/admin/pages/AdminAiCapacityPage'));

/**
 * Componente de Redirecionamento Inteligente por Perfil de Usuário
 */
const RootRoleRedirect: React.FC = () => {
  const { user, status } = useAuth();

  if (status === 'loading') {
    return <PageLoader />;
  }

  if (!user || status === 'unauthenticated') {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = Boolean(user && (user.is_admin === true || user.role === 'admin' || user.role === 'ADMIN'));
  if (isAdmin) {
    return <Navigate to="/admin/leads" replace />;
  }

  const plan = user.plan?.toLowerCase() || 'free';
  if (plan === 'pro' || plan === 'enterprise') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/demo" replace />;
};

export const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Rota Raiz com Redirecionamento Inteligente */}
        <Route path="/" element={<RootRoleRedirect />} />
        <Route path="/home" element={<RootRoleRedirect />} />

        {/* Rotas Públicas */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />

        {/* 1. PORTAL ADMIN (SaaS CRM, Growth, Planos) — Protegido por AdminRouteGuard */}
        <Route element={<AdminRouteGuard />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin/leads" element={<AdminEnterpriseLeadsPage />} />
            <Route path="/admin/ai-capacity" element={<AdminAiCapacityPage />} />
            <Route path="/admin/growth" element={<AdminGrowthPage />} />
            <Route path="/admin/plans" element={<AdminPlansPage />} />
            <Route path="/plans/admin" element={<Navigate to="/admin/plans" replace />} />
          </Route>
        </Route>

        {/* 2. PORTAL DO LOJISTA (Merchant E-commerce Tools: Pro / Enterprise / Admin) */}
        <Route element={<PaidRouteGuard featureKey="dashboard" />}>
          <Route element={<MerchantLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/products" element={<Navigate to="/catalog" replace />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/credentials" element={<Navigate to="/integrations" replace />} />
            <Route path="/analytics/traffic" element={<TrafficAnalyticsPage />} />
            <Route path="/traffic" element={<Navigate to="/analytics/traffic" replace />} />
            <Route path="/metering" element={<MeteringDashboardPage />} />
            <Route path="/billing/metering" element={<Navigate to="/metering" replace />} />
            <Route path="/wallet" element={<WalletPage />} />
            <Route path="/billing" element={<Navigate to="/wallet" replace />} />
            <Route path="/subscriptions" element={<Navigate to="/wallet" replace />} />
            <Route path="/plans" element={<Navigate to="/wallet" replace />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* 3. PORTAL DO USUÁRIO FREE / DEGUSTAÇÃO */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MemberLayout />}>
            <Route path="/demo" element={<LiveDemoPage />} />
            <Route path="/scraper" element={<LiveDemoPage />} />
          </Route>
        </Route>

        {/* Rota Fallback para URLs desconhecidas */}
        <Route path="*" element={<RootRoleRedirect />} />
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
