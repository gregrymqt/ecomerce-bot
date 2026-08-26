import React, { useState } from 'react';
import { Globe, Key, Eye, EyeOff, ShieldCheck, Loader2 } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
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

  const footerActions = (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button variant="secondary" onClick={onClose} type="button">
        Cancelar
      </Button>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={loading}
        iconLeft={loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
      >
        {loading ? 'Salvando...' : 'Salvar e Testar Conexão'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Configurar Loja Shopify"
      description="Insira o domínio .myshopify.com e o Admin Access Token gerado no app privado da sua loja."
      size="md"
      footer={footerActions}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
            {formError}
          </div>
        )}

        {/* Domínio da Loja */}
        <div className="space-y-1.5">
          <label htmlFor="modal-store-domain" className="text-xs font-semibold text-slate-300 block">
            Domínio da Loja Shopify
          </label>
          <Input
            id="modal-store-domain"
            type="text"
            value={storeDomain}
            onChange={(e) => setStoreDomain(e.target.value)}
            placeholder="minhaloja.myshopify.com"
            required
            iconLeft={<Globe className="h-4 w-4 text-slate-400" />}
          />
        </div>

        {/* Admin Access Token com Toggle Eye/EyeOff */}
        <div className="space-y-1.5">
          <label htmlFor="modal-access-token" className="text-xs font-semibold text-slate-300 block">
            Admin Access Token (shpat_...)
          </label>
          <div className="relative">
            <Input
              id="modal-access-token"
              type={showToken ? 'text' : 'password'}
              value={adminAccessToken}
              onChange={(e) => setAdminAccessToken(e.target.value)}
              placeholder="shpat_xxxxxxxxxxxxxxxxxxxxxxxx"
              required
              iconLeft={<Key className="h-4 w-4 text-slate-400" />}
              className="pr-12"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              className="absolute right-3 top-3.5 text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      </form>
    </Modal>
  );
};
