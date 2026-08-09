import React, { useState, useEffect } from 'react';
import { ShieldCheck, Building, Mail, Phone, Users, CheckCircle, X, Loader2, FileText } from 'lucide-react';
import { authService } from '@/features/auth';
import type { EnterpriseLeadPayload } from '@/features/auth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/display/Card';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form/FormField';
import { getErrorMessage } from '@/utils/errors';

export interface EnterpriseSsoModalProps {
  /** Controla a visibilidade do modal */
  isOpen: boolean;
  /** Callback para fechar o modal */
  onClose: () => void;
  /** E-mail inicial pré-preenchido se fornecido */
  initialEmail?: string;
}

export const EnterpriseSsoModal: React.FC<EnterpriseSsoModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const [formData, setFormData] = useState<EnterpriseLeadPayload>({
    email: initialEmail,
    company_name: '',
    team_size: '11-50 colaboradores',
    phone: '',
    notes: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (initialEmail) {
      setFormData((prev) => ({ ...prev, email: initialEmail }));
    }
  }, [initialEmail]);

  if (!isOpen) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const updated = { ...prev };
        delete updated[name];
        return updated;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email.trim()) {
      errors.email = 'O e-mail corporativo é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = 'Informe um e-mail válido.';
    }

    if (!formData.company_name.trim()) {
      errors.company_name = 'O nome da empresa é obrigatório.';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setError(null);

    try {
      await authService.submitEnterpriseLead({
        email: formData.email.trim(),
        company_name: formData.company_name.trim(),
        team_size: formData.team_size?.trim() || undefined,
        phone: formData.phone?.trim() || undefined,
        notes: formData.notes?.trim() || undefined,
      });

      setIsSuccess(true);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao enviar solicitação corporativa.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setIsSuccess(false);
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <Card
        glass
        className="w-full max-w-lg p-6 sm:p-8 shadow-2xl bg-slate-900/95 border-slate-800 text-slate-100 relative overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        {/* Botão Fechar */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          aria-label="Fechar modal"
        >
          <X className="w-5 h-5" />
        </button>

        {isSuccess ? (
          /* Estado de Sucesso */
          <div className="text-center space-y-6 py-4">
            <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto border border-emerald-500/20">
              <CheckCircle className="w-8 h-8 animate-bounce" />
            </div>

            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-100">
                Solicitação Registrada!
              </h3>
              <p className="text-sm text-slate-300">
                Obrigado pelo interesse no <strong>Plano Corporativo</strong>. Um de nossos especialistas de contas Enterprise entrará em contato em até 24 horas para liberar sua demonstração.
              </p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleClose}
              className="w-full min-h-[44px] h-11 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all"
            >
              Entendi, obrigado!
            </Button>
          </div>
        ) : (
          /* Formulário de Captura */
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-bold text-slate-100">
                  SSO Enterprise (SAML / OIDC)
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  Integração sob consulta para o Plano Corporativo (Okta, Azure AD, Google Workspace)
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="error" title="Erro ao enviar">
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField
                label="E-mail Corporativo"
                name="email"
                type="email"
                required
                placeholder="seu.email@empresa.com.br"
                value={formData.email}
                onChange={handleChange}
                error={fieldErrors.email}
                iconLeft={<Mail className="w-5 h-5 shrink-0" />}
                className="min-h-[44px] text-sm bg-slate-950/60 border-slate-800 focus:ring-2 focus:ring-indigo-500"
              />

              <FormField
                label="Nome da Empresa / Organização"
                name="company_name"
                type="text"
                required
                placeholder="ex: Minha Empresa S/A"
                value={formData.company_name}
                onChange={handleChange}
                error={fieldErrors.company_name}
                iconLeft={<Building className="w-5 h-5 shrink-0" />}
                className="min-h-[44px] text-sm bg-slate-950/60 border-slate-800 focus:ring-2 focus:ring-indigo-500"
              />

              {/* Tamanho da Equipe */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Tamanho da Equipe
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Users className="w-5 h-5" />
                  </div>
                  <select
                    name="team_size"
                    value={formData.team_size}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 min-h-[44px] h-11 text-base sm:text-sm rounded-lg bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="1-10 colaboradores">1-10 colaboradores</option>
                    <option value="11-50 colaboradores">11-50 colaboradores</option>
                    <option value="51-200 colaboradores">51-200 colaboradores</option>
                    <option value="200+ colaboradores">200+ colaboradores</option>
                  </select>
                </div>
              </div>

              <FormField
                label="Telefone / WhatsApp (Opcional)"
                name="phone"
                type="tel"
                placeholder="(11) 98765-4321"
                value={formData.phone || ''}
                onChange={handleChange}
                iconLeft={<Phone className="w-5 h-5 shrink-0" />}
                className="min-h-[44px] text-sm bg-slate-950/60 border-slate-800 focus:ring-2 focus:ring-indigo-500"
              />

              {/* Observações */}
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Provedor de Identidade / Observações (Opcional)
                </label>
                <div className="relative">
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="ex: Utilizamos Okta SAML 2.0 e desejamos provisionamento automático."
                    value={formData.notes || ''}
                    onChange={handleChange}
                    className="w-full p-3 text-base sm:text-sm rounded-lg bg-slate-950/60 border border-slate-800 text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none"
                  />
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                iconLeft={isLoading ? <Loader2 className="w-5 h-5 animate-spin shrink-0" /> : <FileText className="w-5 h-5 shrink-0" />}
                className="w-full min-h-[44px] h-11 text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-all mt-2"
              >
                {isLoading ? 'Enviando...' : 'Solicitar Atendimento Corporativo'}
              </Button>
            </form>
          </div>
        )}
      </Card>
    </div>
  );
};
