/**
 * src/features/admin/components/leads/LeadProvisionModal.tsx
 *
 * Modal para Aprovação e Provisionamento em 1 Clique de Contas SSO Enterprise.
 */

import React from 'react';
import { Building, Users, ShieldCheck } from 'lucide-react';
import { Modal } from '@/components/ui/overlay/Modal';
import { FormField } from '@/components/ui/form/FormField';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import type { EnterpriseLead } from '../../types/leads.types';

interface LeadProvisionModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetLead: EnterpriseLead | null;
  tenantName: string;
  setTenantName: (val: string) => void;
  adminName: string;
  setAdminName: (val: string) => void;
  credits: number;
  setCredits: (val: number) => void;
  managedCredit: number;
  setManagedCredit: (val: number) => void;
  password: string;
  setPassword: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isProvisioning: boolean;
  successMsg: string | null;
  errorMsg: string | null;
}

export const LeadProvisionModal: React.FC<LeadProvisionModalProps> = ({
  isOpen,
  onClose,
  targetLead,
  tenantName,
  setTenantName,
  adminName,
  setAdminName,
  credits,
  setCredits,
  managedCredit,
  setManagedCredit,
  password,
  setPassword,
  onSubmit,
  isProvisioning,
  successMsg,
  errorMsg,
}) => {
  if (!targetLead) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Aprovar & Provisionar Conta Enterprise"
      description="Crie o Tenant Enterprise e a conta administrativa com controle total para a empresa contratante."
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-6">
        {errorMsg && (
          <Alert variant="error" title="Erro no Provisionamento">
            {errorMsg}
          </Alert>
        )}

        {successMsg && (
          <Alert variant="success" title="Sucesso!">
            {successMsg}
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            label="Nome da Organização / Tenant"
            name="tenant_name"
            type="text"
            required
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            iconLeft={<Building className="w-4 h-4 text-indigo-400" />}
          />

          <FormField
            label="Nome do Administrador da Empresa"
            name="admin_name"
            type="text"
            required
            value={adminName}
            onChange={(e) => setAdminName(e.target.value)}
            iconLeft={<Users className="w-4 h-4 text-indigo-400" />}
          />

          <FormField
            label="Cota Inicial de Créditos (Produtos)"
            name="credits"
            type="number"
            required
            value={credits}
            onChange={(e) => setCredits(parseInt(e.target.value) || 0)}
          />

          <FormField
            label="Saldo de Inferência de IA (R$)"
            name="managed_credits"
            type="number"
            step="0.01"
            required
            value={managedCredit}
            onChange={(e) => setManagedCredit(parseFloat(e.target.value) || 0)}
          />

          <div className="sm:col-span-2">
            <FormField
              label="Senha Temporária (Opcional - Gerada automaticamente se vazia)"
              name="temp_password"
              type="text"
              placeholder="ex: Empresa@2026!"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="bg-indigo-500/10 p-4 rounded-xl border border-indigo-500/20 text-xs text-indigo-300 space-y-1.5">
          <p className="font-bold flex items-center gap-1.5 text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            Permissão Concedida: Papel TENANT_ADMIN
          </p>
          <p>
            O usuário <strong>{targetLead.email}</strong> terá controle total para gerenciar catálogos, conexões
            Shopify/Nuvemshop, saldos e chaves BYOK de IA <strong>estritamente dentro da sua loja</strong>.
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onClose}
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
    </Modal>
  );
};

export default LeadProvisionModal;
