/**
 * src/features/admin/pages/AdminEnterpriseLeadsPage.tsx
 *
 * Mini-CRM de Gestão e Pipeline de Vendas para Leads SSO Enterprise (SAML / Okta / Azure AD).
 * Suporta visualização híbrida (Kanban Pipeline + Tabela Dinâmica), histórico de anotações,
 * ações de contato rápido (WhatsApp / E-mail) e Provisionamento de Contas Enterprise em 1 clique.
 */

import React from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { useAdminLeads } from '../hooks/useAdminLeads';
import { useEnterpriseProvision } from '../hooks/useEnterpriseProvision';
import {
  LeadsMetricsCards,
  LeadsToolbar,
  LeadsKanbanPipeline,
  LeadsDataTable,
  LeadDetailModal,
  LeadProvisionModal,
} from '../components';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';

export const AdminEnterpriseLeadsPage: React.FC = () => {
  const {
    viewMode,
    setViewMode,
    metrics,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedStatusFilter,
    setSelectedStatusFilter,
    filteredLeads,
    selectedLead,
    isDetailModalOpen,
    setIsDetailModalOpen,
    notesInput,
    setNotesInput,
    statusSelect,
    setStatusSelect,
    isSavingNotes,
    saveNotesError,
    fetchLeads,
    handleOpenDetailModal,
    handleSaveLeadDetails,
  } = useAdminLeads();

  const {
    isProvisionModalOpen,
    setIsProvisionModalOpen,
    targetLead,
    provisionTenantName,
    setProvisionTenantName,
    provisionAdminName,
    setProvisionAdminName,
    provisionCredits,
    setProvisionCredits,
    provisionManagedCredit,
    setProvisionManagedCredit,
    provisionPassword,
    setProvisionPassword,
    isProvisioning,
    provisionSuccessMsg,
    provisionError,
    handleOpenProvisionModal,
    handleExecuteProvision,
  } = useEnterpriseProvision();

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 space-y-8">
      <SEO
        title="Mini-CRM Leads Enterprise | Painel Admin"
        description="Gestão do pipeline de vendas, atendimento de leads corporativos e provisionamento de contas Enterprise."
      />

      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-tight">
                Mini-CRM de Leads Enterprise
              </h1>
              <p className="text-sm text-slate-400">
                Pipeline de vendas corporativas, atendimento de SSO (SAML/Okta) e provisionamento com 1 clique.
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <Alert variant="error" title="Erro ao carregar leads">
          {error}
        </Alert>
      )}

      {/* Cards de Métricas do Funil */}
      <LeadsMetricsCards metrics={metrics} />

      {/* Barra de Filtros e Busca */}
      <LeadsToolbar
        viewMode={viewMode}
        setViewMode={setViewMode}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        selectedStatusFilter={selectedStatusFilter}
        setSelectedStatusFilter={setSelectedStatusFilter}
        onRefresh={fetchLeads}
        isLoading={isLoading}
      />

      {/* Exibição Principal (Kanban ou Tabela) */}
      {isLoading && filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <span className="text-sm font-medium">Carregando pipeline de leads...</span>
        </div>
      ) : viewMode === 'kanban' ? (
        <LeadsKanbanPipeline
          leads={filteredLeads}
          onOpenDetailModal={handleOpenDetailModal}
          onOpenProvisionModal={handleOpenProvisionModal}
        />
      ) : (
        <LeadsDataTable
          leads={filteredLeads}
          onOpenDetailModal={handleOpenDetailModal}
          onOpenProvisionModal={handleOpenProvisionModal}
        />
      )}

      {/* Modal de Detalhes & Anotações de CRM */}
      <LeadDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        selectedLead={selectedLead}
        statusSelect={statusSelect}
        setStatusSelect={setStatusSelect}
        notesInput={notesInput}
        setNotesInput={setNotesInput}
        onSave={handleSaveLeadDetails}
        isSaving={isSavingNotes}
        saveError={saveNotesError}
        onOpenProvisionModal={handleOpenProvisionModal}
      />

      {/* Modal de Provisionamento Enterprise em 1 Clique */}
      <LeadProvisionModal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        targetLead={targetLead}
        tenantName={provisionTenantName}
        setTenantName={setProvisionTenantName}
        adminName={provisionAdminName}
        setAdminName={setProvisionAdminName}
        credits={provisionCredits}
        setCredits={setProvisionCredits}
        managedCredit={provisionManagedCredit}
        setManagedCredit={setProvisionManagedCredit}
        password={provisionPassword}
        setPassword={setProvisionPassword}
        onSubmit={(e) => handleExecuteProvision(e, fetchLeads)}
        isProvisioning={isProvisioning}
        successMsg={provisionSuccessMsg}
        errorMsg={provisionError}
      />
    </div>
  );
};

export default AdminEnterpriseLeadsPage;
