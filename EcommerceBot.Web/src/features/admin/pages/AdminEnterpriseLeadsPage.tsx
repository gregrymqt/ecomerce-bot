/**
 * src/features/admin/pages/AdminEnterpriseLeadsPage.tsx
 *
 * Mini-CRM de Gestão e Pipeline de Vendas para Leads SSO Enterprise (SAML / Okta / Azure AD).
 * Suporta visualização híbrida (Kanban Pipeline + Tabela Dinâmica), histórico de anotações,
 * ações de contato rápido (WhatsApp / E-mail) e Provisionamento de Contas Enterprise em 1 clique.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Building,
  Mail,
  Phone,
  Users,
  Search,
  CheckCircle2,
  Clock,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  LayoutGrid,
  List,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import {
  adminLeadsService,
  type EnterpriseLead,
  type EnterpriseLeadsSummaryMetrics,
} from '../services/adminLeads.service';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Badge } from '@/components/ui/feedback/Badge';
import { Modal } from '@/components/ui/overlay/Modal';
import { FormField } from '@/components/ui/form/FormField';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

type ViewMode = 'kanban' | 'table';

interface KanbanColumnConfig {
  id: EnterpriseLead['status'];
  label: string;
  badgeVariant: 'purple' | 'info' | 'warning' | 'success' | 'error' | 'default';
  accentColor: string;
  icon: React.ReactNode;
}

const PIPELINE_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'PENDING',
    label: 'Novos Leads',
    badgeVariant: 'purple',
    accentColor: 'border-indigo-500/50 bg-indigo-500/5',
    icon: <Clock className="w-4 h-4 text-indigo-400" />,
  },
  {
    id: 'CONTACTED',
    label: 'Em Contato',
    badgeVariant: 'info',
    accentColor: 'border-sky-500/50 bg-sky-500/5',
    icon: <MessageSquare className="w-4 h-4 text-sky-400" />,
  },
  {
    id: 'QUALIFIED',
    label: 'Em Negociação',
    badgeVariant: 'warning',
    accentColor: 'border-amber-500/50 bg-amber-500/5',
    icon: <Sparkles className="w-4 h-4 text-amber-400" />,
  },
  {
    id: 'CONVERTED',
    label: 'Convertidos / Ativos',
    badgeVariant: 'success',
    accentColor: 'border-emerald-500/50 bg-emerald-500/5',
    icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
  },
  {
    id: 'REJECTED',
    label: 'Descartados',
    badgeVariant: 'error',
    accentColor: 'border-rose-500/50 bg-rose-500/5',
    icon: <AlertCircle className="w-4 h-4 text-rose-400" />,
  },
];

export const AdminEnterpriseLeadsPage: React.FC = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [leads, setLeads] = useState<EnterpriseLead[]>([]);
  const [metrics, setMetrics] = useState<EnterpriseLeadsSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modais
  const [selectedLead, setSelectedLead] = useState<EnterpriseLead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState<boolean>(false);

  // Form State para Anotações / Edição de Status
  const [notesInput, setNotesInput] = useState<string>('');
  const [statusSelect, setStatusSelect] = useState<string>('PENDING');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);

  // Form State para Provisionamento Enterprise
  const [provisionTenantName, setProvisionTenantName] = useState<string>('');
  const [provisionAdminName, setProvisionAdminName] = useState<string>('');
  const [provisionCredits, setProvisionCredits] = useState<number>(50000);
  const [provisionManagedCredit, setProvisionManagedCredit] = useState<number>(100.0);
  const [provisionPassword, setProvisionPassword] = useState<string>('');
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const fetchLeads = async () => {
    setIsLoading(true);
    try {
      const data = await adminLeadsService.getLeads(
        selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
        searchQuery || undefined
      );
      setLeads(data.leads || []);
      setMetrics(data.metrics || null);
    } catch (err) {
      console.error('Erro ao carregar leads do CRM:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [selectedStatusFilter]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.email.toLowerCase().includes(q) ||
        (l.companyName && l.companyName.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const handleOpenDetailModal = (lead: EnterpriseLead) => {
    setSelectedLead(lead);
    setNotesInput(lead.internalNotes || '');
    setStatusSelect(lead.status);
    setIsDetailModalOpen(true);
  };

  const handleSaveLeadDetails = async () => {
    if (!selectedLead) return;
    setIsSavingNotes(true);
    try {
      await adminLeadsService.updateStatus(selectedLead.id, {
        status: statusSelect,
        internalNotes: notesInput,
      });
      setIsDetailModalOpen(false);
      fetchLeads();
    } catch (err) {
      console.error('Erro ao salvar anotações do lead:', err);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleOpenProvisionModal = (lead: EnterpriseLead) => {
    setSelectedLead(lead);
    setProvisionTenantName(lead.companyName || `Loja de ${lead.email.split('@')[0]}`);
    setProvisionAdminName(lead.companyName ? `Admin ${lead.companyName}` : 'Administrador Enterprise');
    setProvisionCredits(50000);
    setProvisionManagedCredit(100.0);
    setProvisionPassword('');
    setProvisionError(null);
    setProvisionSuccessMsg(null);
    setIsProvisionModalOpen(true);
  };

  const handleExecuteProvision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setIsProvisioning(true);
    setProvisionError(null);
    setProvisionSuccessMsg(null);

    try {
      const resp = await adminLeadsService.provisionAccount(selectedLead.id, {
        tenantName: provisionTenantName.trim(),
        adminFullName: provisionAdminName.trim(),
        creditsBalance: provisionCredits,
        managedCreditBalance: provisionManagedCredit,
        temporaryPassword: provisionPassword.trim() || undefined,
        internalNotes: notesInput ? notesInput : undefined,
      });

      setProvisionSuccessMsg(`Conta Enterprise provisionada com sucesso! Tenant ID: ${resp.tenantId}`);
      setTimeout(() => {
        setIsProvisionModalOpen(false);
        fetchLeads();
      }, 1800);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao provisionar conta enterprise.');
      setProvisionError(msg);
    } finally {
      setIsProvisioning(false);
    }
  };

  const getWhatsAppLink = (lead: EnterpriseLead) => {
    if (!lead.phone) return null;
    const cleanPhone = lead.phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
    const text = encodeURIComponent(
      `Olá! Sou o especialista de contas corporativas do E-commerce Bot. Vi o interesse da ${lead.companyName || 'sua empresa'} em nossa solução de SSO Enterprise e catálogo inteligente. Podemos conversar?`
    );
    return `https://wa.me/${phoneWithCountry}?text=${text}`;
  };

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

        <div className="flex items-center gap-3">
          {/* Alternador de Visão */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setViewMode('kanban')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'kanban'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              Kanban Pipeline
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer',
                viewMode === 'table'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              )}
            >
              <List className="w-4 h-4" />
              Tabela Dinâmica
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchLeads}
            disabled={isLoading}
            iconLeft={<RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />}
            className="min-h-[38px] bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800"
          >
            Atualizar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas do Funil */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card glass className="p-4 bg-slate-900/60 border-slate-800/80">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Total de Leads</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100">
            {metrics?.totalLeads ?? 0}
          </div>
          <span className="text-xs text-slate-400">Oportunidades criadas</span>
        </Card>

        <Card glass className="p-4 bg-slate-900/60 border-indigo-900/40">
          <div className="flex items-center justify-between text-indigo-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Novos (Pendentes)</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-indigo-300">
            {metrics?.pendingCount ?? 0}
          </div>
          <span className="text-xs text-indigo-400/80">Aguardando 1º contato</span>
        </Card>

        <Card glass className="p-4 bg-slate-900/60 border-sky-900/40">
          <div className="flex items-center justify-between text-sky-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Em Contato</span>
            <MessageSquare className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-sky-300">
            {metrics?.contactedCount ?? 0}
          </div>
          <span className="text-xs text-sky-400/80">Conversa iniciada</span>
        </Card>

        <Card glass className="p-4 bg-slate-900/60 border-amber-900/40">
          <div className="flex items-center justify-between text-amber-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Em Negociação</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">
            {metrics?.qualifiedCount ?? 0}
          </div>
          <span className="text-xs text-amber-400/80">Alinhando proposta</span>
        </Card>

        <Card glass className="p-4 bg-slate-900/60 border-emerald-900/40 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-emerald-400 text-xs font-medium uppercase tracking-wider mb-2">
            <span>Convertidos</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-300">
            {metrics?.convertedCount ?? 0}
          </div>
          <span className="text-xs text-emerald-400/80">Contas Enterprise ativas</span>
        </Card>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-xl border border-slate-800/80">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por empresa, e-mail, telefone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950/60 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
          />
        </div>

        {viewMode === 'table' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-slate-400 font-semibold uppercase">Filtrar:</span>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-sm text-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
            >
              <option value="ALL">Todos os Estágios</option>
              <option value="PENDING">Novos Leads</option>
              <option value="CONTACTED">Em Contato</option>
              <option value="QUALIFIED">Em Negociação</option>
              <option value="CONVERTED">Convertidos</option>
              <option value="REJECTED">Descartados</option>
            </select>
          </div>
        )}
      </div>

      {/* Visualização 1: Kanban Pipeline */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
          {PIPELINE_COLUMNS.map((column) => {
            const columnLeads = filteredLeads.filter((l) => l.status === column.id);

            return (
              <div
                key={column.id}
                className="flex flex-col bg-slate-900/40 rounded-xl border border-slate-800/80 p-3 min-h-[500px]"
              >
                {/* Header da Coluna */}
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/60">
                  <div className="flex items-center gap-2">
                    {column.icon}
                    <h3 className="text-sm font-bold text-slate-200">{column.label}</h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300">
                    {columnLeads.length}
                  </span>
                </div>

                {/* Lista de Cards da Coluna */}
                <div className="space-y-3 overflow-y-auto max-h-[700px] pr-1">
                  {columnLeads.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-800/60 rounded-lg">
                      Nenhum lead nesta etapa
                    </div>
                  ) : (
                    columnLeads.map((lead) => {
                      const waLink = getWhatsAppLink(lead);

                      return (
                        <Card
                          key={lead.id}
                          glass
                          className={cn(
                            'p-4 bg-slate-900/90 border-slate-800 shadow-md hover:border-slate-700 transition-all space-y-3 cursor-pointer group',
                            lead.status === 'CONVERTED' && 'border-emerald-900/40 bg-emerald-950/10'
                          )}
                          onClick={() => handleOpenDetailModal(lead)}
                        >
                          {/* Nome da Empresa & Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="space-y-0.5">
                              <h4 className="text-sm font-bold text-slate-100 group-hover:text-indigo-400 transition-colors">
                                {lead.companyName || 'Empresa não informada'}
                              </h4>
                              <p className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                                <Mail className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                {lead.email}
                              </p>
                            </div>
                          </div>

                          {/* Metadados do Lead */}
                          <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                            {lead.teamSize && (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                <span>{lead.teamSize}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-2 text-slate-400">
                                <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {lead.notes && (
                              <p className="text-slate-400 italic line-clamp-2 text-[11px] pt-1 border-t border-slate-800/40">
                                &ldquo;{lead.notes}&rdquo;
                              </p>
                            )}
                          </div>

                          {/* Barra de Ações Rápidas */}
                          <div
                            className="flex items-center justify-between pt-2 border-t border-slate-800/60 gap-1.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-1">
                              {waLink && (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-md transition-colors"
                                  title="Iniciar WhatsApp"
                                >
                                  <Phone className="w-4 h-4" />
                                </a>
                              )}
                              <a
                                href={`mailto:${lead.email}`}
                                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-md transition-colors"
                                title="Enviar E-mail"
                              >
                                <Mail className="w-4 h-4" />
                              </a>
                            </div>

                            {lead.status !== 'CONVERTED' ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenProvisionModal(lead)}
                                iconLeft={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                                className="text-xs h-7 px-2 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                              >
                                Provisionar
                              </Button>
                            ) : (
                              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Ativo
                              </span>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Visualização 2: Tabela Dinâmica */}
      {viewMode === 'table' && (
        <Card glass className="bg-slate-900/60 border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/80 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Empresa / Lead</th>
                  <th className="px-6 py-4">Equipe</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Estágio</th>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      Nenhum lead encontrado com os filtros atuais.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map((lead) => {
                    const waLink = getWhatsAppLink(lead);
                    return (
                      <tr
                        key={lead.id}
                        className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                        onClick={() => handleOpenDetailModal(lead)}
                      >
                        <td className="px-6 py-4">
                          <div className="font-bold text-slate-100">{lead.companyName || 'N/A'}</div>
                          <div className="text-xs text-slate-400">{lead.email}</div>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-300">
                          {lead.teamSize || 'Não informado'}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {lead.phone ? (
                              <span className="text-xs text-slate-300">{lead.phone}</span>
                            ) : (
                              <span className="text-xs text-slate-400">-</span>
                            )}
                            {waLink && (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <Badge
                            variant={
                              lead.status === 'CONVERTED'
                                ? 'success'
                                : lead.status === 'QUALIFIED'
                                ? 'warning'
                                : lead.status === 'CONTACTED'
                                ? 'info'
                                : lead.status === 'REJECTED'
                                ? 'error'
                                : 'purple'
                            }
                          >
                            {lead.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-400">
                          {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {lead.status !== 'CONVERTED' && (
                              <Button
                                type="button"
                                variant="primary"
                                size="sm"
                                onClick={() => handleOpenProvisionModal(lead)}
                                iconLeft={<ShieldCheck className="w-4 h-4" />}
                                className="bg-emerald-600 hover:bg-emerald-500 text-xs h-8"
                              >
                                Provisionar
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenDetailModal(lead)}
                              className="text-xs h-8 bg-slate-900 border-slate-700"
                            >
                              Detalhes
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal 1: Detalhes & Anotações de CRM */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title="Detalhes & Anotações do Lead Enterprise"
        description="Atualize o estágio no pipeline de vendas e registre o histórico de negociações."
        size="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {selectedLead && selectedLead.status !== 'CONVERTED' && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsDetailModalOpen(false);
                    handleOpenProvisionModal(selectedLead);
                  }}
                  iconLeft={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                  className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
                >
                  Provisionar Conta Agora
                </Button>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDetailModalOpen(false)}
                className="bg-slate-900 border-slate-700 text-slate-300"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleSaveLeadDetails}
                isLoading={isSavingNotes}
                className="bg-indigo-600 hover:bg-indigo-500"
              >
                Salvar Alterações
              </Button>
            </div>
          </div>
        }
      >
        {selectedLead && (
          <div className="space-y-6">
            {/* Informações Gerais */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">Empresa:</span>
                <p className="text-sm font-bold text-slate-100">{selectedLead.companyName || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">E-mail Corporativo:</span>
                <p className="text-sm text-indigo-400">{selectedLead.email}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">Telefone / WhatsApp:</span>
                <p className="text-sm text-slate-200">{selectedLead.phone || 'Não informado'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-400 font-semibold uppercase">Tamanho da Equipe:</span>
                <p className="text-sm text-slate-200">{selectedLead.teamSize || 'Não informado'}</p>
              </div>
              <div className="sm:col-span-2">
                <span className="text-xs text-slate-400 font-semibold uppercase">Notas / IdP Informado:</span>
                <p className="text-xs text-slate-300 italic mt-1 bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                  {selectedLead.notes || 'Nenhuma observação informada no cadastro inicial.'}
                </p>
              </div>
            </div>

            {/* Alteração de Estágio do Pipeline */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Estágio do Funil (Status):
              </label>
              <select
                value={statusSelect}
                onChange={(e) => setStatusSelect(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
              >
                <option value="PENDING">📥 Novos Leads (Pendente)</option>
                <option value="CONTACTED">💬 Em Contato</option>
                <option value="QUALIFIED">🤝 Em Negociação / Proposta</option>
                <option value="CONVERTED">🚀 Convertido / Ativo</option>
                <option value="REJECTED">❌ Descartado / Sem Perfil</option>
              </select>
            </div>

            {/* Anotações Internas do CRM */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Histórico & Anotações Internas de Negociação:
              </label>
              <textarea
                rows={4}
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="ex: Conversamos dia 29/08 com o diretor de TI. Desejam 100k produtos/mês e integração com 3 lojas Shopify..."
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal 2: Provisionamento de Conta Enterprise com 1 Clique */}
      <Modal
        isOpen={isProvisionModalOpen}
        onClose={() => setIsProvisionModalOpen(false)}
        title="Aprovar & Provisionar Conta Enterprise"
        description="Crie o Tenant Enterprise e a conta administrativa com controle total para a empresa contratante."
        size="lg"
      >
        {selectedLead && (
          <form onSubmit={handleExecuteProvision} className="space-y-6">
            {provisionError && (
              <Alert variant="error" title="Erro no Provisionamento">
                {provisionError}
              </Alert>
            )}

            {provisionSuccessMsg && (
              <Alert variant="success" title="Sucesso!">
                {provisionSuccessMsg}
              </Alert>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                label="Nome da Organização / Tenant"
                name="tenant_name"
                type="text"
                required
                value={provisionTenantName}
                onChange={(e) => setProvisionTenantName(e.target.value)}
                iconLeft={<Building className="w-4 h-4 text-indigo-400" />}
                className="bg-slate-950 border-slate-800 min-h-[44px]"
              />

              <FormField
                label="Nome do Administrador da Empresa"
                name="admin_name"
                type="text"
                required
                value={provisionAdminName}
                onChange={(e) => setProvisionAdminName(e.target.value)}
                iconLeft={<Users className="w-4 h-4 text-indigo-400" />}
                className="bg-slate-950 border-slate-800 min-h-[44px]"
              />

              <FormField
                label="Cota Inicial de Créditos (Produtos)"
                name="credits"
                type="number"
                required
                value={provisionCredits}
                onChange={(e) => setProvisionCredits(parseInt(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 min-h-[44px]"
              />

              <FormField
                label="Saldo de Inferência de IA (R$)"
                name="managed_credits"
                type="number"
                step="0.01"
                required
                value={provisionManagedCredit}
                onChange={(e) => setProvisionManagedCredit(parseFloat(e.target.value) || 0)}
                className="bg-slate-950 border-slate-800 min-h-[44px]"
              />

              <div className="sm:col-span-2">
                <FormField
                  label="Senha Temporária (Opcional - Gerada automaticamente se vazia)"
                  name="temp_password"
                  type="text"
                  placeholder="ex: Empresa@2026!"
                  value={provisionPassword}
                  onChange={(e) => setProvisionPassword(e.target.value)}
                  className="bg-slate-950 border-slate-800 min-h-[44px]"
                />
              </div>
            </div>

            <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-indigo-200">
                <ShieldCheck className="w-4 h-4 text-indigo-400" />
                Permissão Concedida: Papel TENANT_ADMIN
              </p>
              <p>
                O usuário <strong>{selectedLead.email}</strong> terá controle total para gerenciar catálogos, conexões
                Shopify/Nuvemshop, saldos e chaves BYOK de IA <strong>estritamente dentro da sua loja</strong>.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={() => setIsProvisionModalOpen(false)}
                className="bg-slate-900 border-slate-700 text-slate-300 min-h-[44px]"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isProvisioning}
                iconLeft={<ShieldCheck className="w-4 h-4" />}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold min-h-[44px]"
              >
                Confirmar & Provisionar Conta Enterprise
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

export default AdminEnterpriseLeadsPage;
