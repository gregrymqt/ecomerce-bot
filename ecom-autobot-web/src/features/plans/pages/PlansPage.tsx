import React, { useState } from 'react';
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  Sparkles,
  Layers,
  CheckCircle2,
  Lock,
  Eye,
  Settings,
} from 'lucide-react';
import { usePlans } from '../hooks/usePlans';
import { PublicPlanCards } from '../components/PublicPlanCards';
import { AdminPlanTable } from '../components/AdminPlanTable';
import { AdminPlanModal } from '../components/AdminPlanModal';
import type { Plan, CreatePlanPayload } from '../types/plan.type';
import { Alert } from '@/components/ui/feedback/Alert';
import { Button } from '@/components/ui/Button';
import { StatCard } from '@/components/ui/display/StatCard';
import { useAuth } from '@/features/auth';

export const PlansPage: React.FC = () => {
  const { user } = useAuth();

  // Verificação de privilégios de Admin
  const isAdminUser =
    (user as any)?.role === 'admin' ||
    (user as any)?.is_admin === true ||
    user?.email?.toLowerCase().includes('admin');

  // Estado para alternar visualização admin (se for administrador)
  const [viewMode, setViewMode] = useState<'admin' | 'public'>(
    isAdminUser ? 'admin' : 'public'
  );

  const isCurrentAdminView = isAdminUser && viewMode === 'admin';

  // Hook de Planos
  const {
    plans,
    total,
    loading,
    actionLoading,
    error,
    refresh,
    createPlan,
    updatePlan,
    cancelPlan,
  } = usePlans({ isAdmin: isCurrentAdminView, autoFetch: true });

  // Estados do Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  const handleOpenCreateModal = () => {
    setEditingPlan(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setIsModalOpen(true);
  };

  const handleSavePlan = async (payload: CreatePlanPayload) => {
    if (editingPlan) {
      await updatePlan(editingPlan.id, payload);
    } else {
      await createPlan(payload);
    }
  };

  const handleCancelPlan = async (planId: string) => {
    await cancelPlan(planId);
  };

  const activePlansCount = plans.filter(
    (p) => p.status === 'active' || p.status === 'authorized'
  ).length;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            {isAdminUser ? (
              <span className="flex items-center gap-1">
                <Lock className="w-3.5 h-3.5" /> Painel de Controle Admin
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Catálogo de Planos
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            {isCurrentAdminView
              ? 'Gerenciamento de Planos Mercado Pago'
              : 'Planos & Assinaturas Recorrentes'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isCurrentAdminView
              ? 'Crie, edite e inative planos com cobrança automatizada via Mercado Pago Preapproval.'
              : 'Escolha o plano ideal para automatizar seu e-commerce com IA, extração contínua e sincronização.'}
          </p>
        </div>

        {/* Ações do Cabeçalho */}
        <div className="flex flex-wrap items-center gap-3 self-start sm:self-center">
          {isAdminUser && (
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'admin'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Settings className="w-3.5 h-3.5 inline mr-1" /> Admin
              </button>
              <button
                type="button"
                onClick={() => setViewMode('public')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  viewMode === 'public'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5 inline mr-1" /> Ver Vitrine
              </button>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="md"
            className="h-11 min-h-[44px] text-sm font-semibold border-slate-300 dark:border-slate-700"
            iconLeft={<RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />}
            onClick={() => refresh()}
            disabled={loading}
          >
            Atualizar
          </Button>

          {isCurrentAdminView && (
            <Button
              type="button"
              variant="primary"
              size="md"
              className="h-11 min-h-[44px] text-sm font-bold shadow-sm"
              iconLeft={<Plus className="w-4 h-4" />}
              onClick={handleOpenCreateModal}
            >
              Criar Novo Plano
            </Button>
          )}
        </div>
      </div>

      {/* Exibição de Erros */}
      {error && (
        <Alert variant="error" title="Erro no módulo de planos">
          {error}
        </Alert>
      )}

      {/* Cards Estatísticos (Visíveis para Admin) */}
      {isCurrentAdminView && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Total de Planos"
            value={total}
            description="Cadastrados no banco / MP"
            icon={<Layers className="w-5 h-5" />}
          />
          <StatCard
            title="Planos Ativos"
            value={activePlansCount}
            description="Disponíveis para contratação"
            icon={<CheckCircle2 className="w-5 h-5" />}
          />
          <StatCard
            title="Integração Preapproval"
            value="Mercado Pago"
            description="OAuth & Webhooks sincronizados"
            icon={<ShieldCheck className="w-5 h-5" />}
          />
        </div>
      )}

      {/* Renderização Condicional: Visão Admin vs Vitrine Pública */}
      {isCurrentAdminView ? (
        <section className="space-y-4">
          <AdminPlanTable
            plans={plans}
            loading={loading}
            actionLoading={actionLoading}
            onEditPlan={handleOpenEditModal}
            onCancelPlan={handleCancelPlan}
            onRefresh={refresh}
          />
        </section>
      ) : (
        <section className="space-y-6">
          <div className="text-center max-w-2xl mx-auto space-y-2 mb-8">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-3 py-1 rounded-full border border-indigo-200 dark:border-indigo-800">
              Escolha seu plano
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Preços simples e transparentes
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sem contratos engessados. Cancele quando quiser com suporte total Mercado Pago.
            </p>
          </div>

          <PublicPlanCards plans={plans} loading={loading} />
        </section>
      )}

      {/* Modal Admin de Criação / Edição */}
      {isCurrentAdminView && (
        <AdminPlanModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setEditingPlan(null);
          }}
          onSubmit={handleSavePlan}
          isLoading={actionLoading}
          initialPlan={editingPlan}
        />
      )}
    </div>
  );
};

export default PlansPage;
