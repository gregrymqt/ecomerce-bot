/**
 * src/features/dashboard/index.ts
 * Exportação pública centralizada da Feature de Dashboard & Telemetria.
 */

export * from './types/dashboard.type';
export * from './services/dashboard.service';
export * from './hooks/useDashboard';
export * from './components/DashboardKpiGrid';
export * from './components/VolumePerformanceChart';
export * from './components/RecentActivityTable';
export * from './components/TokenTelemetryCard';
export * from './components/SystemHealthWidget';
export * from './pages/DashboardPage';
