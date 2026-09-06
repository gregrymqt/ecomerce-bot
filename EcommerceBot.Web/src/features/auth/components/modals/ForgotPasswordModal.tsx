/**
 * src/features/auth/components/modals/ForgotPasswordModal.tsx
 *
 * Modal acessível para solicitação de link de recuperação de senha.
 */

import React from 'react';
import { Mail, KeyRound, CheckCircle, ArrowLeft, Send } from 'lucide-react';
import { useForgotPassword } from '../../hooks/useForgotPassword';
import { Modal } from '@/components/ui/overlay/Modal';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/feedback/Alert';
import { FormField } from '@/components/ui/form';

export interface ForgotPasswordModalProps {
  /** Controla a visibilidade do modal */
  isOpen: boolean;
  /** Callback para fechar o modal */
  onClose: () => void;
  /** E-mail inicial pré-preenchido se fornecido no formulário de login */
  initialEmail?: string;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  initialEmail = '',
}) => {
  const {
    email,
    setEmail,
    isLoading,
    error,
    isSuccess,
    fieldError,
    setFieldError,
    resetState,
    handleSubmit,
  } = useForgotPassword({ initialEmail });

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Recuperação de Senha"
      description="Informe seu e-mail cadastrado para receber as instruções de redefinição de acesso."
      size="md"
    >
      <div className="p-4 sm:p-6 space-y-5">
        {/* Estado de Sucesso */}
        {isSuccess ? (
          <div className="space-y-4 py-2 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <CheckCircle className="w-8 h-8 shrink-0" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-slate-100">
                Verifique sua Caixa de Entrada
              </h3>
              <p className="text-sm text-slate-300 max-w-sm mx-auto leading-relaxed">
                Se o e-mail <span className="font-semibold text-indigo-300">{email}</span> estiver cadastrado, enviamos um link com instruções para redefinir sua senha.
              </p>
            </div>

            <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-400 text-left space-y-1">
              <p className="flex items-center gap-1.5 font-medium text-slate-300">
                <KeyRound className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                Segurança e Validade:
              </p>
              <p>• O link expira em <strong>15 minutos</strong> e só pode ser usado uma vez.</p>
              <p>• Caso não localize na caixa principal, confira sua pasta de spam ou lixo eletrônico.</p>
            </div>

            <Button
              type="button"
              variant="primary"
              size="md"
              onClick={handleClose}
              iconLeft={<ArrowLeft className="w-4 h-4 shrink-0" />}
              className="w-full min-h-[44px] text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg mt-2"
            >
              Voltar ao Login
            </Button>
          </div>
        ) : (
          /* Formulário de Envio */
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {error && (
              <Alert variant="error" title="Atenção">
                {error}
              </Alert>
            )}

            <div className="p-3 bg-indigo-950/30 border border-indigo-500/20 rounded-lg text-xs text-indigo-200/90 leading-relaxed flex gap-2 items-start">
              <KeyRound className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
              <span>
                Enviaremos um link de uso único para redefinição segura de sua senha. O link terá validade estrita de 15 minutos.
              </span>
            </div>

            <FormField
              label="Seu E-mail Cadastrado"
              name="email"
              type="email"
              required
              placeholder="seu.email@empresa.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (fieldError) setFieldError(null);
              }}
              error={fieldError || undefined}
              iconLeft={<Mail className="w-5 h-5 shrink-0" />}
              autoComplete="email"
              disabled={isLoading}
              className="min-h-[44px] text-base bg-slate-900/50 border-slate-700/80 focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleClose}
                disabled={isLoading}
                className="w-full sm:w-1/2 min-h-[44px] text-base border-slate-700 text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                iconRight={<Send className="w-4 h-4 shrink-0" />}
                className="w-full sm:w-1/2 min-h-[44px] text-base font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {isLoading ? 'Enviando...' : 'Enviar Link'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};

export default ForgotPasswordModal;
