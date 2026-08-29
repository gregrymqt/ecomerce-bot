/**
 * src/features/admin/hooks/useEnterpriseProvision.ts
 *
 * Hook de provisionamento com 1 clique de Contas Enterprise (Tenant + Usuário Admin + Saldos).
 */

import { useState } from 'react';
import { adminLeadsService } from '../services/adminLeads.service';
import type { EnterpriseLead } from '../types/leads.types';
import { getErrorMessage } from '@/utils/errors';

export const useEnterpriseProvision = () => {
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState<boolean>(false);
  const [targetLead, setTargetLead] = useState<EnterpriseLead | null>(null);

  // Form Fields
  const [provisionTenantName, setProvisionTenantName] = useState<string>('');
  const [provisionAdminName, setProvisionAdminName] = useState<string>('');
  const [provisionCredits, setProvisionCredits] = useState<number>(50000);
  const [provisionManagedCredit, setProvisionManagedCredit] = useState<number>(100.0);
  const [provisionPassword, setProvisionPassword] = useState<string>('');

  // Status
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);
  const [provisionSuccessMsg, setProvisionSuccessMsg] = useState<string | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);

  const handleOpenProvisionModal = (lead: EnterpriseLead) => {
    setTargetLead(lead);
    setProvisionTenantName(lead.companyName || `Loja de ${lead.email.split('@')[0]}`);
    setProvisionAdminName(lead.companyName ? `Admin ${lead.companyName}` : 'Administrador Enterprise');
    setProvisionCredits(50000);
    setProvisionManagedCredit(100.0);
    setProvisionPassword('');
    setProvisionError(null);
    setProvisionSuccessMsg(null);
    setIsProvisionModalOpen(true);
  };

  const closeProvisionModal = () => {
    setIsProvisionModalOpen(false);
    setTargetLead(null);
    setProvisionError(null);
    setProvisionSuccessMsg(null);
  };

  const handleExecuteProvision = async (
    e: React.FormEvent,
    onSuccessCallback?: () => void
  ) => {
    e.preventDefault();
    if (!targetLead) return;

    setIsProvisioning(true);
    setProvisionError(null);
    setProvisionSuccessMsg(null);

    try {
      const resp = await adminLeadsService.provisionAccount(targetLead.id, {
        tenantName: provisionTenantName.trim(),
        adminFullName: provisionAdminName.trim(),
        creditsBalance: provisionCredits,
        managedCreditBalance: provisionManagedCredit,
        temporaryPassword: provisionPassword.trim() || undefined,
        internalNotes: targetLead.internalNotes || undefined,
      });

      setProvisionSuccessMsg(`Conta Enterprise provisionada com sucesso! Tenant ID: ${resp.tenantId}`);
      setTimeout(() => {
        closeProvisionModal();
        if (onSuccessCallback) {
          onSuccessCallback();
        }
      }, 1800);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao provisionar conta enterprise.');
      setProvisionError(msg);
    } finally {
      setIsProvisioning(false);
    }
  };

  return {
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
    closeProvisionModal,
    handleExecuteProvision,
  };
};

export default useEnterpriseProvision;
