/**
 * src/features/plans/index.ts
 * Ponto de exportação público do módulo de planos (DDD Architecture).
 */

export * from './types/plans.type';
export * from './services/plans.service';
export * from './hooks/useAdminPlans';
export * from './components/AdminPlanTable';
export * from './components/AdminPlanModal';
export * from './pages/AdminPlansPage';
