/**
 * src/features/settings/hooks/useTenantSso.ts
 *
 * Custom Hook para gestão de Papéis e Mapeamentos de Grupos SSO / IdP.
 * Encapsula consultas, criação e remoção de mapeamentos via tenantSsoService.
 */

import { useState, useEffect, useCallback } from 'react';
import { tenantSsoService } from '../services/tenantSso.service';
import type { Role, TenantSsoMapping, UseTenantSsoReturn } from '../types';
import { getErrorMessage } from '@/utils/errors';

export function useTenantSso(): UseTenantSsoReturn {
  const [roles, setRoles] = useState<Role[]>([]);
  const [mappings, setMappings] = useState<TenantSsoMapping[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form State para Novo Mapeamento
  const [groupNameInput, setGroupNameInput] = useState<string>('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [isDefaultRoleInput, setIsDefaultRoleInput] = useState<boolean>(false);

  const fetchData = useCallback(async (isManualAction = false) => {
    if (isManualAction) {
      setLoading(true);
      setError(null);
    }
    try {
      const [rolesData, mappingsData] = await Promise.all([
        tenantSsoService.getRoles(),
        tenantSsoService.getMappings(),
      ]);
      setRoles(rolesData);
      setMappings(mappingsData);
      setSelectedRoleId((prev) => {
        if (!prev && rolesData.length > 0) {
          return rolesData[0].id;
        }
        return prev;
      });
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao carregar dados de SSO e Roles.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    Promise.all([tenantSsoService.getRoles(), tenantSsoService.getMappings()])
      .then(([rolesData, mappingsData]) => {
        if (!isCancelled) {
          setRoles(rolesData);
          setMappings(mappingsData);
          setSelectedRoleId((prev) => {
            if (!prev && rolesData.length > 0) {
              return rolesData[0].id;
            }
            return prev;
          });
        }
      })
      .catch((err: unknown) => {
        if (!isCancelled) {
          setError(getErrorMessage(err, 'Erro ao carregar dados de SSO e Roles.'));
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setLoading(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  const handleCreateMapping = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!groupNameInput.trim() || !selectedRoleId) {
        setError('Por favor, informe o nome do grupo e selecione um papel.');
        return;
      }

      setSaving(true);
      setError(null);
      setSuccessMsg(null);

      try {
        await tenantSsoService.createMapping({
          idpGroupName: groupNameInput.trim(),
          roleId: selectedRoleId,
          isDefaultRole: isDefaultRoleInput,
        });

        setSuccessMsg(`Mapeamento para o grupo "${groupNameInput.trim()}" criado com sucesso!`);
        setGroupNameInput('');
        setIsDefaultRoleInput(false);
        await fetchData();
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Erro ao criar mapeamento de grupo SSO.'));
      } finally {
        setSaving(false);
      }
    },
    [groupNameInput, selectedRoleId, isDefaultRoleInput, fetchData]
  );

  const handleDeleteMapping = useCallback(
    async (id: string, groupName: string) => {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(`Tem certeza que deseja remover o mapeamento do grupo "${groupName}"?`)
      ) {
        return;
      }

      try {
        await tenantSsoService.deleteMapping(id);
        setSuccessMsg(`Mapeamento "${groupName}" removido.`);
        await fetchData();
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Erro ao remover mapeamento.'));
      }
    },
    [fetchData]
  );

  return {
    roles,
    mappings,
    loading,
    saving,
    error,
    successMsg,
    groupNameInput,
    setGroupNameInput,
    selectedRoleId,
    setSelectedRoleId,
    isDefaultRoleInput,
    setIsDefaultRoleInput,
    fetchData,
    handleCreateMapping,
    handleDeleteMapping,
  };
}

export default useTenantSso;
