/**
 * src/features/admin/components/leads/LeadDetailModal.tsx
 *
 * Modal de Detalhes, Anotações Internas e Atualização de Estágio do Lead Enterprise.
 */

import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import type { EnterpriseLead } from '../../types/leads.types';

interface LeadDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLead: EnterpriseLead | null;
  statusSelect: string;
  setStatusSelect: (status: string) => void;
  notesInput: string;
  setNotesInput: (notes: string) => void;
  onSave: () => void;
  isSaving: boolean;
  saveError?: string | null;
  onOpenProvisionModal: (lead: EnterpriseLead) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  isOpen,
  onClose,
  selectedLead,
  statusSelect,
  setStatusSelect,
  notesInput,
  setNotesInput,
  onSave,
  isSaving,
  saveError,
  onOpenProvisionModal,
}) => {
  if (!selectedLead) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Detalhes & Anotações do Lead Enterprise"
      description="Atualize o estágio no pipeline de vendas e registre o histórico de negociações."
      size="lg"
      footer={
        <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-3">
          <div>
            {selectedLead.status !== 'CONVERTED' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onClose();
                  onOpenProvisionModal(selectedLead);
                }}
                iconLeft={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
                className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 min-h-[44px]"
              >
                Provisionar Conta Agora
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="bg-slate-900 border-slate-700 text-slate-300 min-h-[44px]"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onSave}
              isLoading={isSaving}
              className="bg-indigo-600 hover:bg-indigo-500 min-h-[44px]"
            >
              Salvar Alterações
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {saveError && (
          <Alert variant="error" title="Erro ao salvar">
            {saveError}
          </Alert>
        )}

        {/* Informações Gerais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-950/60 p-4 rounded-xl border border-slate-800">
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">Empresa:</span>
            <p className="text-sm font-bold text-slate-100">{selectedLead.companyName || 'N/A'}</p>
          </div>
          <div>
            <span className="text-xs text-slate-400 font-semibold uppercase">E-mail Corporativo:</span>
            <p className="text-sm text-indigo-400 break-all">{selectedLead.email}</p>
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
            className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-base sm:text-sm text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px]"
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
            className="w-full p-3 bg-slate-950 border border-slate-800 rounded-lg text-base sm:text-sm text-slate-100 placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
          />
        </div>
      </div>
    </Modal>
  );
};

export default LeadDetailModal;
