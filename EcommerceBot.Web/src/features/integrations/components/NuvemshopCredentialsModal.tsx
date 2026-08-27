import React, { useState } from 'react';
import {
  Store,
  Key,
  Eye,
  EyeOff,
  ShieldCheck,
  Loader2,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';

interface NuvemshopCredentialsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: { store_id: string; access_token: string }) => Promise<boolean>;
  onConnectOAuth: () => void;
  loading?: boolean;
  initialStoreId?: string;
}

export const NuvemshopCredentialsModal: React.FC<NuvemshopCredentialsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  onConnectOAuth,
  loading = false,
  initialStoreId = '',
}) => {
  const [activeTab, setActiveTab] = useState<'oauth' | 'manual'>('oauth');
  const [storeId, setStoreId] = useState(initialStoreId);
  const [accessToken, setAccessToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanStoreId = storeId.trim();
    const cleanToken = accessToken.trim();

    if (!cleanStoreId) {
      setFormError('Por favor, informe o Store ID (Identificador numérico da loja).');
      return;
    }
    if (!cleanToken || cleanToken.length < 10) {
      setFormError('Por favor, informe um Access Token válido da Nuvemshop.');
      return;
    }

    const success = await onSave({
      store_id: cleanStoreId,
      access_token: cleanToken,
    });

    if (success) {
      setAccessToken('');
    }
  };

  const footerActions = (
    <div className="flex items-center justify-end gap-3 w-full">
      <Button variant="secondary" onClick={onClose} type="button" disabled={loading}>
        Cancelar
      </Button>
      {activeTab === 'manual' ? (
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
          className="bg-purple-600 hover:bg-purple-500 font-bold min-h-[44px]"
        >
          {loading ? 'Validando & Conectando...' : 'Salvar e Testar Conexão'}
        </Button>
      ) : (
        <Button
          variant="primary"
          onClick={onConnectOAuth}
          iconLeft={<ExternalLink className="h-4 w-4" />}
          className="bg-purple-600 hover:bg-purple-500 font-bold min-h-[44px]"
        >
          Ir para Autorização Nuvemshop
        </Button>
      )}
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Conectar Loja Nuvemshop"
      description="Escolha a forma de conexão: autorização rápida via OAuth 2.0 ou inserção manual de credenciais."
      size="md"
      footer={footerActions}
    >
      <div className="space-y-4">
        {/* Abas de Conexão */}
        <div className="grid grid-cols-2 gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('oauth')}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'oauth'
                ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            OAuth 2.0 (1-Clique)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`py-2 px-3 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-purple-600/20 border border-purple-500/50 text-purple-300 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Configuração Manual (Token)
          </button>
        </div>

        {activeTab === 'oauth' ? (
          <div className="py-4 space-y-4 text-center sm:text-left">
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              O fluxo OAuth 2.0 oficial é a forma mais recomendada e segura de conectar sua loja Nuvemshop sem expor chaves de API.
            </p>
            <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2 text-purple-300 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-purple-400" />
                <span>O que acontece a seguir?</span>
              </div>
              <p>
                Você será redirecionado para a página de login da Nuvemshop para autorizar o app oficial do E-commerce Bot. Após autorizar, sua loja será conectada automaticamente.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3.5 text-xs text-red-400">
                {formError}
              </div>
            )}

            {/* Accordion: Guia Rápido */}
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowGuide(!showGuide)}
                className="w-full p-3.5 flex items-center justify-between text-xs font-semibold text-purple-300 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4 text-purple-400 shrink-0" />
                  <span>Como obter seu Store ID e Access Token na Nuvemshop?</span>
                </div>
                {showGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>

              {showGuide && (
                <div className="p-4 pt-1 border-t border-slate-800/80 text-xs text-slate-300 space-y-2.5 bg-slate-950/40">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Passo 1:</strong> No painel da Nuvemshop, o seu <strong>Store ID (User ID)</strong> é o número identificador que aparece na URL do seu painel administrativo (ex: <code>3920192</code>).
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                    <span>
                      <strong>Passo 2:</strong> Acesse o portal de desenvolvedores da Nuvemshop ou crie um app privado para gerar o <strong>Bearer Access Token</strong>.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Store ID */}
            <div className="space-y-1.5">
              <label htmlFor="modal-store-id" className="text-xs font-semibold text-slate-300 block">
                Store ID da Nuvemshop (User ID)
              </label>
              <Input
                id="modal-store-id"
                type="text"
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                placeholder="Ex: 3920192"
                required
                iconLeft={<Store className="h-4 w-4 text-slate-400" />}
              />
            </div>

            {/* Access Token */}
            <div className="space-y-1.5">
              <label htmlFor="modal-nuvem-token" className="text-xs font-semibold text-slate-300 block">
                Bearer Access Token
              </label>
              <div className="relative">
                <Input
                  id="modal-nuvem-token"
                  type={showToken ? 'text' : 'password'}
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  placeholder="Insira seu Access Token da Nuvemshop"
                  required
                  iconLeft={<Key className="h-4 w-4 text-slate-400" />}
                  className="pr-12 font-mono"
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

            {/* Aviso Criptografia */}
            <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-3.5 flex items-center gap-3 text-xs text-purple-300">
              <ShieldCheck className="h-5 w-5 text-purple-400 shrink-0" />
              <span>
                Chave criptografada com <strong>AES-256 GCM (BYOK)</strong> e persistida no SQL Server 2022.
              </span>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
};
