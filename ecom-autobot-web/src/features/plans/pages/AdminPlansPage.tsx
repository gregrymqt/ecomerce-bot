/**
 * src/features/plans/pages/AdminPlansPage.tsx
 * Painel Administrativo de Gestão de Planos de Assinatura (Mercado Pago REST API & PostgreSQL/Redis).
 */

import React from 'react';
import { Plus, Search, ShieldCheck, Database, Cloud, RefreshCw, Filter } from 'lucide-react';
import { useAdminPlans } from '../hooks/useAdminPlans';
import { AdminPlanTable } from '../components/AdminPlanTable';
import { AdminPlanModal } from '../components/AdminPlanModal';

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
    openCreateModal,
    openEditModal,
    closeModal,
    handleSavePlan,
    handleToggleStatus,
    refreshPlans,
  } = useAdminPlans();

  const activePlansCount = plans.filter((p) => p.status === 'active').length;

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header & Page Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60 p-6 rounded-3xl border border-slate-800 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </span>
            <h1 className="text-2xl font-bold text-slate-100 tracking-tight">
              Gestão de Planos de Assinatura
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Painel administrativo para sincronização com Mercado Pago Preapproval e banco local.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> Criar Novo Plano
        </button>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Total de Planos ({sourceMode === 'local' ? 'Local' : 'Mercado Pago'})
            </span>
            <div className="text-2xl font-bold text-slate-100">{plans.length}</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Planos Ativos
            </span>
            <div className="text-2xl font-bold text-emerald-400">{activePlansCount}</div>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 p-5 rounded-2xl flex items-center gap-4">
          <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Modo de Consulta
            </span>
            <div className="text-sm font-bold text-slate-200 mt-0.5">
              {sourceMode === 'local' ? 'Cache Local & Banco' : 'API Mercado Pago Direct'}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar: Filters, Source Mode & Search */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-800/80">
        <div className="flex flex-wrap items-center gap-3">
          {/* Source Toggle */}
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex items-center">
            <button
              onClick={() => setSourceMode('local')}
              className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                sourceMode === 'local'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Database className="w-3.5 h-3.5" /> Banco Local
            </button>
            <button
              onClick={() => setSourceMode('mp')}
              className={`min-h-[44px] px-4 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
                sourceMode === 'mp'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Cloud className="w-3.5 h-3.5" /> API Mercado Pago
            </button>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1 rounded-xl border border-slate-800 min-h-[44px]">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium outline-none cursor-pointer"
            >
              <option value="all" className="bg-slate-900 text-slate-200">
                Todos os Status
              </option>
              <option value="active" className="bg-slate-900 text-slate-200">
                Somente Ativos
              </option>
              <option value="canceled" className="bg-slate-900 text-slate-200">
                Somente Cancelados
              </option>
            </select>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 lg:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome ou ID..."
              className="w-full min-h-[44px] pl-10 pr-4 bg-slate-950 border border-slate-800 rounded-xl text-slate-100 text-xs sm:text-sm focus:border-indigo-500 outline-none transition-colors"
            />
          </div>

          <button
            onClick={refreshPlans}
            title="Atualizar Lista"
            className="min-h-[44px] min-w-[44px] p-2.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 text-slate-300 rounded-xl transition-colors flex items-center justify-center"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Feedback */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Main Data Table */}
      <AdminPlanTable
        plans={plans}
        loading={loading}
        onEdit={openEditModal}
        onToggleStatus={handleToggleStatus}
        onRefresh={refreshPlans}
      />

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
