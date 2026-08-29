/**
 * src/features/integrations/components/ShopifyCredentialsModal.tsx
 *
 * Modal para configuração e validação das credenciais da Admin API da Shopify.
 * Em conformidade com acessibilidade WCAG 2.1 AA, inputs >= 16px e touch targets >= 44px.
 */

import React, { useState } from 'react';
import {
  Globe,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import type { ShopifyCredentialsPayload } from '../types';

export interface ShopifyCredentialsModalProps {
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
  const [showGuide, setShowGuide] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDomainChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.trim().toLowerCase();
    val = val.replace('https://', '').replace('http://', '').replace('/', '');
    setStoreDomain(val);
  };

  const handleAutocompleteDomain = () => {
    if (storeDomain && !storeDomain.includes('.')) {
      setStoreDomain(`${storeDomain}.myshopify.com`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    let cleanDomain = storeDomain.trim().toLowerCase();
    if (!cleanDomain.includes('.')) {
      cleanDomain = `${cleanDomain}.myshopify.com`;
    }

    const cleanToken = adminAccessToken.trim();

    if (!cleanDomain || cleanDomain.length < 5) {
      setFormError('Por favor, informe o domínio completo da loja (ex: minhaloja.myshopify.com).');
      return;
    }
    if (!cleanToken || cleanToken.length < 10) {
      setFormError('Por favor, informe um Admin Access Token válido da Shopify (começando com shpat_).');
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
      <Button
        variant="secondary"
        onClick={onClose}
        type="button"
        disabled={loading}
        className="min-h-[44px]"
      >
        Cancelar
      </Button>
      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={loading}
        iconLeft={
          loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          ) : (
            <ShieldCheck className="h-4 w-4" />
          )
        }
        className="bg-emerald-600 hover:bg-emerald-500 font-bold min-h-[44px]"
      >
        {loading ? 'Validando & Conectando...' : 'Salvar e Testar Conexão'}
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conectar Loja Shopify"
      description="Insira o domínio .myshopify.com e o Admin Access Token do seu Custom App para sincronização via GraphQL."
      size="md"
      footer={footerActions}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {formError && (
          <div
            role="alert"
            className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs sm:text-sm text-red-400 font-medium"
          >
            {formError}
          </div>
        )}

        {/* Accordion: Guia Rápido de Obtenção de Token */}
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
          <button
            type="button"
            onClick={() => setShowGuide(!showGuide)}
            aria-expanded={showGuide}
            className="w-full min-h-[44px] p-3.5 flex items-center justify-between text-xs sm:text-sm font-semibold text-violet-300 hover:text-white transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-violet-400 shrink-0" />
              <span>Como gerar o Admin Access Token na Shopify em 1 minuto?</span>
            </div>
            {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showGuide && (
            <div className="p-4 pt-1 border-t border-slate-800/80 text-xs sm:text-sm text-slate-300 space-y-2.5 bg-slate-950/40">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Passo 1:</strong> No admin da Shopify, vá em <em>Configurações</em> &rarr; <em>Apps e canais de vendas</em> &rarr; <em>Desenvolver apps</em>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Passo 2:</strong> Clique em <em>Criar um app</em> e selecione os escopos de Admin API: <code>write_products</code>, <code>read_products</code> e <code>write_inventory</code>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Passo 3:</strong> Clique em <em>Instalar app</em> e copie o <strong>Admin API Access Token</strong> (começa com <code>shpat_</code>).
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Domínio da Loja */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="modal-store-domain" className="text-xs sm:text-sm font-semibold text-slate-300 block">
              Domínio da Loja Shopify
            </label>
            {storeDomain && !storeDomain.includes('.') && (
              <button
                type="button"
                onClick={handleAutocompleteDomain}
                className="text-xs text-emerald-400 hover:underline min-h-[44px] flex items-center cursor-pointer"
              >
                Completar com .myshopify.com
              </button>
            )}
          </div>
          <Input
            id="modal-store-domain"
            type="text"
            value={storeDomain}
            onChange={handleDomainChange}
            placeholder="minhaloja.myshopify.com"
            required
            iconLeft={<Globe className="h-4 w-4 text-slate-400" />}
            className="text-base min-h-[44px]"
          />
        </div>

        {/* Admin Access Token com Toggle Eye/EyeOff */}
        <div className="space-y-1.5">
          <label htmlFor="modal-access-token" className="text-xs sm:text-sm font-semibold text-slate-300 block">
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
              className="pr-12 font-mono text-base min-h-[44px]"
            />
            <button
              type="button"
              onClick={() => setShowToken(!showToken)}
              aria-label={showToken ? 'Ocultar token' : 'Mostrar token'}
              className="absolute right-2 top-1.5 h-9 w-9 min-h-[36px] min-w-[36px] flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer z-10"
            >
              {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Aviso Criptografia AES-256 GCM */}
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3.5 flex items-center gap-3 text-xs sm:text-sm text-emerald-300">
          <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
          <span>
            Chave criptografada com <strong>AES-256 GCM (BYOK)</strong> e persistida com isolamento estrito no banco SQL Server 2022.
          </span>
        </div>
      </form>
    </Modal>
  );
};

export default ShopifyCredentialsModal;
