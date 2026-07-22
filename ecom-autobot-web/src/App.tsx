import { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  Send,
  Trash2,
  Globe,
  MessageSquare,
  Sparkles,
} from 'lucide-react';
import {
  Label,
  HelperText,
  FormField,
  Button,
  Textarea,
  Select,
  Checkbox,
  ToggleSwitch,
} from './components/ui';

export default function App() {
  // Form State
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [category, setCategory] = useState('tech');
  const [bio, setBio] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [newsletter, setNewsletter] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isIndeterminate, setIsIndeterminate] = useState(true);

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (val && !val.includes('@')) {
      setEmailError('Por favor, insira um e-mail válido contendo @.');
    } else {
      setEmailError('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      alert('Formulário enviado com sucesso!');
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-8 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Componentes de Formulário & Ações (Chunk 1 & 2)
            </h1>
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Design System Mobile-First com Touch Targets de 44px, Prevenção de Auto-Zoom no Safari, Acessibilidade WCAG e suporte a forwardRef.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Seção 1: Inputs & Select */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-200 dark:border-slate-800">
              Campos de Texto & Seletores
            </h2>

            <FormField
              label="Endereço de E-mail"
              required
              type="email"
              placeholder="seu.email@exemplo.com"
              value={email}
              onChange={handleEmailChange}
              error={emailError}
              helperText={!emailError ? 'Nós nunca compartilharemos seu e-mail.' : undefined}
              iconLeft={<Mail className="w-5 h-5" />}
            />

            <FormField
              label="Senha de Acesso"
              required
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              iconLeft={<Lock className="w-5 h-5" />}
              iconRight={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-slate-600 dark:hover:text-slate-300 focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              }
              helperText="Mínimo de 8 caracteres"
            />

            <div className="space-y-1.5">
              <Label htmlFor="category-select" required>
                Categoria Principal
              </Label>
              <Select
                id="category-select"
                iconLeft={<Globe className="w-5 h-5" />}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                options={[
                  { label: 'Tecnologia & Software', value: 'tech' },
                  { label: 'E-commerce & Vendas', value: 'ecom' },
                  { label: 'Marketing Digital', value: 'mkt' },
                  { label: 'Suporte ao Cliente', value: 'support' },
                ]}
              />
              <HelperText>Selecione o nicho principal da sua loja.</HelperText>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bio-textarea">Descrição da Empresa / Bot</Label>
              <Textarea
                id="bio-textarea"
                placeholder="Descreva detalhadamente o objetivo do seu robô de vendas..."
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
              <HelperText>Esta informação será usada para personalizar as respostas do bot.</HelperText>
            </div>
          </div>

          {/* Seção 2: Checkboxes & Switches */}
          <div className="space-y-4 pt-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-200 dark:border-slate-800">
              Controles de Seleção (Checkboxes & Switches)
            </h2>

            <div className="space-y-3">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                label="Aceito os termos de serviço e privacidade"
                description="Você precisa concordar para continuar com a integração."
              />

              <Checkbox
                id="indeterminate-demo"
                indeterminate={isIndeterminate}
                checked={!isIndeterminate}
                onChange={() => setIsIndeterminate(!isIndeterminate)}
                label="Permissões Parciais (Exemplo Indeterminate)"
                description="Clique para alternar o estado indeterminado."
              />

              <ToggleSwitch
                id="newsletter-switch"
                checked={newsletter}
                onChange={setNewsletter}
                label="Notificações via WhatsApp em Tempo Real"
                description="Receba alertas instantâneos a cada venda efetuada pelo bot."
              />

              <ToggleSwitch
                id="disabled-switch"
                disabled
                checked={false}
                label="Recurso Beta (Desabilitado)"
                description="Este recurso estará disponível na próxima atualização."
              />
            </div>
          </div>

          {/* Seção 3: Botões & Variantes */}
          <div className="space-y-4 pt-2">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-200 dark:border-slate-800">
              Botões e Ações
            </h2>

            <div className="flex flex-wrap gap-3">
              <Button type="submit" variant="primary" isLoading={isSubmitting} iconLeft={<Send className="w-4 h-4" />}>
                Salvar Configurações
              </Button>

              <Button type="button" variant="secondary" iconLeft={<MessageSquare className="w-4 h-4" />}>
                Testar Bot
              </Button>

              <Button type="button" variant="outline" iconRight={<CheckCircle2 className="w-4 h-4" />}>
                Verificar Status
              </Button>

              <Button type="button" variant="ghost">
                Cancelar
              </Button>

              <Button type="button" variant="danger" iconLeft={<Trash2 className="w-4 h-4" />}>
                Excluir Bot
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button size="sm" variant="primary">
                Botão Pequeno (sm)
              </Button>
              <Button size="md" variant="primary">
                Botão Médio (md)
              </Button>
              <Button size="lg" variant="primary">
                Botão Grande (lg)
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
