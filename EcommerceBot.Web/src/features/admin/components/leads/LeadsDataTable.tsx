/**
 * src/features/admin/components/leads/LeadsDataTable.tsx
 *
 * Tabela Dinâmica do Mini-CRM de Leads Enterprise com badges de status e ações rápidas.
 */

import React from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { Card } from '@/components/ui/display/Card';
import { Badge } from '@/components/ui/feedback/Badge';
import { Button } from '@/components/ui/Button';
import type { EnterpriseLead, LeadStatus } from '../../types/leads.types';

interface LeadsDataTableProps {
  leads: EnterpriseLead[];
  onOpenDetailModal: (lead: EnterpriseLead) => void;
  onOpenProvisionModal: (lead: EnterpriseLead) => void;
}

const getBadgeVariant = (status: LeadStatus) => {
  switch (status) {
    case 'CONVERTED':
      return 'success';
    case 'QUALIFIED':
      return 'warning';
    case 'CONTACTED':
      return 'info';
    case 'REJECTED':
      return 'error';
    case 'PENDING':
    default:
      return 'purple';
  }
};

export const LeadsDataTable: React.FC<LeadsDataTableProps> = ({
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
    <Card glass className="bg-slate-900/60 border-slate-800 overflow-hidden shadow-xl p-0">
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
            {leads.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  Nenhum lead encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              leads.map((lead) => {
                const waLink = getWhatsAppLink(lead);
                return (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => onOpenDetailModal(lead)}
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
                            className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded min-h-[32px] min-w-[32px] flex items-center justify-center"
                            title="WhatsApp"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={getBadgeVariant(lead.status)}>
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
                            onClick={() => onOpenProvisionModal(lead)}
                            iconLeft={<ShieldCheck className="w-4 h-4" />}
                            className="bg-emerald-600 hover:bg-emerald-500 text-xs min-h-[44px] px-3"
                          >
                            Provisionar
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onOpenDetailModal(lead)}
                          className="text-xs min-h-[44px] px-3 bg-slate-900 border-slate-700"
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
  );
};

export default LeadsDataTable;
