/**
 * src/features/admin/components/leads/LeadsKanbanPipeline.tsx
 *
 * Visualização Kanban em 5 colunas do Pipeline de Vendas Corporativas (SSO Enterprise).
 */

import React from 'react';
import {
  Clock,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import type { EnterpriseLead, LeadStatus } from '../../types/leads.types';

interface KanbanColumnConfig {
  id: LeadStatus;
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

interface LeadsKanbanPipelineProps {
  leads: EnterpriseLead[];
  onOpenDetailModal: (lead: EnterpriseLead) => void;
  onOpenProvisionModal: (lead: EnterpriseLead) => void;
}

export const LeadsKanbanPipeline: React.FC<LeadsKanbanPipelineProps> = ({
  leads,
  onOpenDetailModal,
  onOpenProvisionModal,
}) => {
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
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start">
      {PIPELINE_COLUMNS.map((column) => {
        const columnLeads = leads.filter((l) => l.status === column.id);

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
                      onClick={() => onOpenDetailModal(lead)}
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
                              className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              title="Iniciar WhatsApp"
                            >
                              <Phone className="w-4 h-4" />
                            </a>
                          )}
                          <a
                            href={`mailto:${lead.email}`}
                            className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
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
                            onClick={() => onOpenProvisionModal(lead)}
                            iconLeft={<ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />}
                            className="text-xs min-h-[44px] px-3 bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20"
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
  );
};

export default LeadsKanbanPipeline;
