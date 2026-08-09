/**
 * src/features/integrations/components/ShopifyCredentialsModal.tsx
 *
 * Modal de diálogo para cadastro e edição de credenciais da Shopify.
 * Apresenta campos mascarados com suporte a visualização, aviso de criptografia AES-256 GCM e overlay desfocado.
 */

import React, { useState } from 'react';
import { X, Globe, Key, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import type { ShopifyCredentialsPayload } from '@/features/integrations';

interface ShopifyCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: ShopifyCredentialsPayload) => Promise<boolean>;
  loading?: boolean;
  initialDomain?: string;
}

export const ShopifyCredentialsModal: React.FC<ShopifyCredentialsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  loading = false,
  initialDomain = '',
}) => {
  const [storeDomain, setStoreDomain] = useState(initialDomain);
  const [adminAccessToken, setAdminAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDomain = storeDomain.trim().toLowerCase();
    const cleanToken = adminAccessToken.trim();

    if (!cleanDomain || !cleanDomain.includes('.')) {
      setFormError('Por favor, informe o domínio completo da loja (ex: minhaloja.myshopify.com).');
      return;
    }
    if (!cleanToken || cleanToken.length < 10) {
      setFormError('Por favor, informe um Admin Access Token válido da Shopify.');
      return;
    }

    const success = await onSave({
      store_domain: cleanDomain,
      admin_access_token: cleanToken,
    });

    if (success) {
      setAdminAccessToken('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-2xl bg-[#15121B] border border-[#1E293B] p-6 text-slate-100 shadow-2xl space-y-6 relative"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Botão Fechar (X) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar modal"
          className="absolute right-4 top-4 h-9 w-9 rounded-xl bg-[#090D16] hover:bg-[#1E293B] border border-[#1E293B] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Cabeçalho */}
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-400 mb-1">
            <Key className="h-4 w-4" />
            <span>Credenciais de Acesso API</span>
          </div>
          <h2 id="modal-title" className="text-2xl font-black text-white">
            Configurar Loja Shopify
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Insira o domínio `.myshopify.com` e o Admin Access Token gerado no app privado da sua loja.
          </p>
        </div>

        {formError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            {formError}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Domínio da Loja */}
          <div className="space-y-1.5">
            <label htmlFor="modal-store-domain" className="text-xs font-semibold text-slate-300 block">
              Domínio da Loja Shopify
            </label>
            <div className="relative">
              <input
                id="modal-store-domain"
                type="text"
                value={storeDomain}
                onChange={(e) => setStoreDomain(e.target.value)}
                placeholder="minhaloja.myshopify.com"
                required
                className="w-full min-h-[44px] h-11 pl-10 pr-4 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <Globe className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Admin Access Token com Toggle Eye/EyeOff */}
          <div className="space-y-1.5">
            <label htmlFor="modal-access-token" className="text-xs font-semibold text-slate-300 block">
              Admin Access Token (shpat_...)
            </label>
            <div className="relative">
              <input
                id="modal-access-token"
                type={showToken ? 'text' : 'password'}
                value={adminAccessToken}
                onChange={(e) => setAdminAccessToken(e.target.value)}
                placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
                required
                className="w-full min-h-[44px] h-11 pl-10 pr-12 rounded-xl bg-[#090D16] border border-[#1E293B] text-slate-100 text-base font-mono placeholder-slate-500 focus:outline-none focus:border-violet-500 transition-colors"
              />
              <Key className="absolute left-3 top-3 h-5 w-5 text-slate-400 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
                className="absolute right-3 top-3 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                {showToken ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Aviso Criptografia AES-256 GCM */}
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 flex items-center gap-3 text-xs text-emerald-300">
            <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
            <span>
              Suas credenciais são salvas com criptografia AES-256 GCM (BYOK) utilizando chave mestre isolada por tenant.
            </span>
          </div>

          {/* Botões do Modal */}
          <div className="pt-4 border-t border-[#1E293B] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] h-11 px-5 rounded-xl bg-[#090D16] hover:bg-[#1E293B] border border-[#1E293B] text-slate-300 hover:text-white text-sm font-semibold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={loading}
              className="min-h-[44px] h-11 px-6 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-all shadow-lg shadow-violet-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Salvar e Testar Conexão</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
