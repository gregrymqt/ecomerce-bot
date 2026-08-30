/**
 * src/features/plans/pages/AdminPlansPage.tsx
 *
 * Painel Administrativo de Gestão de Planos de Assinatura.
 * Consome o hook useAdminPlans e exibe métricas, filtros e tabela de planos.
 */

import React from 'react';
import { Plus, Search, ShieldCheck, Database, Cloud, RefreshCw, Filter } from 'lucide-react';
import { useAdminPlans } from '../hooks';
import { AdminPlanTable, AdminPlanModal } from '../components';
import { Alert, Button } from '@/components/ui';

export const AdminPlansPage: React.FC = () => {
  const {
    sourceMode,
    setSourceMode,
    plans,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    isModalOpen,
    editingPlan,
    submitting,
    alertInfo,
    clearAlert,
    openCreateModal,
    openEditModal,
    closeModal,
    handleSavePlan,
    handleToggleStatus,
    refreshPlans,
  } = useAdminPlans();

  const activePlansCount = plans.filter((p) => p.isActive ?? p.status === 'active').length;

  return (
    <div
      role="main"
      aria-label="Gestão de Planos de Assinatura"
      className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-fade-in pb-12"
    >
      {/* Alerta de Feedback Customizado */}
      {alertInfo && (
        <Alert
          variant={alertInfo.variant}
          title={alertInfo.title}
          onClose={clearAlert}
        >
          {alertInfo.message}
        </Alert>
      )}

      {/* Top Header & Page Title */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 p-6 rounded-3xl border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-3">
            <span className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Gestão de Planos de Assinatura
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1 font-mono">
            Sincronização e cadastro de planos da plataforma
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={openCreateModal}
          iconLeft={<Plus className="w-5 h-5" />}
          className="min-h-[44px] px-5 bg-indigo-600 hover:bg-indigo-500 font-bold text-white shadow-lg shadow-indigo-600/25"
        >
          Criar Novo Plano
        </Button>
      </header>

      {/* Metrics Bar - 3 KPI Cards */}
      <section aria-label="Métricas de Planos" className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total de Planos */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Total de Planos ({sourceMode === 'local' ? 'Local' : 'Mercado Pago'})
            </span>
            <div className="text-2xl font-bold text-slate-100 font-mono">{plans.length}</div>
          </div>
        </div>

        {/* Card 2: Planos Ativos */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Planos Ativos
            </span>
            <div className="text-2xl font-bold text-emerald-400 font-mono">{activePlansCount}</div>
          </div>
        </div>

        {/* Card 3: Modo de Consulta */}
        <div className="bg-slate-900/90 border border-slate-800 p-5 rounded-2xl shadow-lg backdrop-blur-md flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Modo de Consulta
            </span>
            <div className="text-sm font-bold text-slate-200 mt-0.5 font-mono">
              {sourceMode === 'local' ? 'Banco de Dados Core' : 'API Mercado Pago Direct'}
            </div>
          </div>
        </div>
      </section>

      {/* Toolbar: Filters, Source Mode & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80 shadow-lg backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Toggle Pills */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => setSourceMode('local')}
              className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                sourceMode === 'local'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Banco Local
            </button>
            <button
              type="button"
              onClick={() => setSourceMode('mp')}
              className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all flex items-center gap-2 cursor-pointer ${
                sourceMode === 'mp'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" /> API Mercado Pago
            </button>
          </div>

          {/* Status Filter Dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 min-h-[44px]">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium font-mono outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">
                Todos os Status
              </option>
              <option value="active" className="bg-slate-900 text-slate-200">
                Somente Ativos
              </option>
              <option value="canceled" className="bg-slate-900 text-slate-200">
                Somente Inativos / Cancelados
              </option>
            </select>
          </div>
        </div>

        {/* Search Input & Refresh Button */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou ID..."
              className="w-full min-h-[44px] pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-base sm:text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          <button
            type="button"
            onClick={refreshPlans}
            title="Atualizar Lista"
            aria-label="Atualizar planos"
            className="min-h-[44px] min-w-[44px] p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors flex items-center justify-center cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="animate-fade-in">
          <Alert variant="error" title="Erro ao Carregar Planos">
            {error}
          </Alert>
        </div>
      )}

      {/* Main Data Table */}
      <section aria-label="Tabela de Planos">
        <AdminPlanTable
          plans={plans}
          loading={loading}
          onEdit={openEditModal}
          onToggleStatus={handleToggleStatus}
          onRefresh={refreshPlans}
        />
      </section>

      {/* Admin Plan Modal */}
      <AdminPlanModal
        isOpen={isModalOpen}
        editingPlan={editingPlan}
        submitting={submitting}
        onClose={closeModal}
        onSave={handleSavePlan}
      />
    </div>
  );
};

export default AdminPlansPage;
