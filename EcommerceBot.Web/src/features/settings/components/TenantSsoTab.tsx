/**
 * src/features/settings/components/TenantSsoTab.tsx
 *
 * Aba de Gestão de Mapeamentos de Grupos SSO (IdP -> Roles) para o TENANT_ADMIN.
 * Permite associar grupos do Okta, Azure AD ou SAML às Roles canônicas do sistema.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { tenantSsoService } from '../services/tenantSso.service';
import type { Role, TenantSsoMapping } from '../types';
import { Card, Button, Badge, Alert, FormField } from '@/components/ui';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/utils/errors';

export const TenantSsoTab: React.FC = () => {
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

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesData, mappingsData] = await Promise.all([
        tenantSsoService.getRoles(),
        tenantSsoService.getMappings(),
      ]);
      setRoles(rolesData);
      setMappings(mappingsData);
      if (rolesData.length > 0 && !selectedRoleId) {
        setSelectedRoleId(rolesData[0].id);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao carregar dados de SSO e Roles.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateMapping = async (e: React.FormEvent) => {
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
      fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao criar mapeamento de grupo SSO.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id: string, groupName: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o mapeamento do grupo "${groupName}"?`)) {
      return;
    }

    try {
      await tenantSsoService.deleteMapping(id);
      setSuccessMsg(`Mapeamento "${groupName}" removido.`);
      fetchData();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Erro ao remover mapeamento.'));
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header da Aba */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            Mapeamento de Grupos SSO / IdP (SAML / Okta / Azure AD)
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Vincule os grupos de usuários do seu Provedor de Identidade corporativo aos papéis de acesso (Roles) na plataforma.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          iconLeft={<RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />}
          className="min-h-[44px] bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
        >
          Recarregar
        </Button>
      </div>

      {error && (
        <Alert variant="error" title="Erro">
          {error}
        </Alert>
      )}

      {successMsg && (
        <Alert variant="success" title="Sucesso!">
          {successMsg}
        </Alert>
      )}

      {/* Formulário de Criação de Novo Mapeamento */}
      <Card glass className="p-6 bg-slate-900/60 border-slate-800 shadow-xl space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-800 text-sm font-bold text-slate-200">
          <Plus className="w-4 h-4 text-indigo-400" />
          <span>Cadastrar Novo Mapeamento de Grupo</span>
        </div>

        <form onSubmit={handleCreateMapping} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <FormField
                label="Nome do Grupo no IdP (Okta / Azure AD / SAML)"
                name="idp_group"
                type="text"
                placeholder="ex: okta-ecommerce-admins"
                required
                value={groupNameInput}
                onChange={(e) => setGroupNameInput(e.target.value)}
                className="bg-slate-950 border-slate-800 min-h-[44px] text-base"
              />
            </div>

            <div>
              <label htmlFor="sso-role-select" className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Papel de Destino (Role)
              </label>
              <select
                id="sso-role-select"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-950 border border-slate-800 rounded-lg text-base text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[44px] cursor-pointer font-sans"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} — {r.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={saving}
                iconLeft={<Plus className="w-4 h-4" />}
                className="w-full min-h-[44px] bg-indigo-600 hover:bg-indigo-500 font-bold"
              >
                Adicionar Regra
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_default_role"
              checked={isDefaultRoleInput}
              onChange={(e) => setIsDefaultRoleInput(e.target.checked)}
              className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <label htmlFor="is_default_role" className="text-xs text-slate-300 cursor-pointer">
              Definir este papel como <strong>Fallback Padrão</strong> para colaboradores que não pertençam a grupos específicos.
            </label>
          </div>
        </form>
      </Card>

      {/* Lista de Mapeamentos Atuais */}
      <Card glass className="bg-slate-900/60 border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users className="w-4 h-4 text-indigo-400" />
            Regras de Mapeamento Configuradas ({mappings.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/50 text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th scope="col" className="px-6 py-3.5">Grupo no IdP</th>
                <th scope="col" className="px-6 py-3.5">Papel Atribuído</th>
                <th scope="col" className="px-6 py-3.5">Tipo</th>
                <th scope="col" className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {mappings.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-400 text-xs">
                    Nenhum mapeamento customizado configurado. O papel padrão <strong>MEMBER</strong> será utilizado para novos logins SSO.
                  </td>
                </tr>
              ) : (
                mappings.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-100">
                      {m.idpGroupName}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant="purple">{m.roleName}</Badge>
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {m.isDefaultRole ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Fallback Padrão
                        </span>
                      ) : (
                        <span className="text-slate-400">Grupo Específico</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMapping(m.id, m.idpGroupName)}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 min-h-[44px] px-3"
                        title="Remover Mapeamento"
                        aria-label={`Remover mapeamento do grupo ${m.idpGroupName}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Caixa Informativa sobre JIT & Resolução */}
      <div className="bg-indigo-950/20 border border-indigo-900/40 rounded-xl p-4 text-xs text-indigo-300 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-200">
          <HelpCircle className="w-4 h-4 text-indigo-400" />
          <span>Como funciona a resolução de papéis durante o login SSO?</span>
        </div>
        <p>
          Quando um membro da sua equipe realiza login via SAML 2.0 / Okta / Azure AD, o sistema inspeciona as <em>claims</em> de grupos enviadas pelo IdP. Se o colaborador fizer parte de múltiplos grupos mapeados, a permissão mais abrangente (ex: <strong>TENANT_ADMIN &gt; CATALOG_OPERATOR &gt; MEMBER &gt; VIEWER</strong>) será atribuída automaticamente via provisionamento <em>Just-In-Time</em>.
        </p>
      </div>
    </div>
  );
};

export default TenantSsoTab;
