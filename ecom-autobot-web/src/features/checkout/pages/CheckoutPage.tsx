import React from 'react';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckoutWidget } from '../components/CheckoutWidget';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/features/auth';

export const CheckoutPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, currentTenant } = useAuth();

  const planName = searchParams.get('plan') || 'Plano Pro SaaS';
  const amountParam = parseFloat(searchParams.get('amount') || '99.90');

  const defaultItems = [
    {
      title: planName,
      unit_price: amountParam,
      quantity: 1,
      description: 'Assinatura automatizada com extração via IA e sincronização contínua.',
    },
  ];

  const externalRef = `ref_${currentTenant || 'tenant'}_${Date.now()}`;

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Cabeçalho de Navegação e Título */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-2 text-xs font-semibold px-0 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            iconLeft={<ArrowLeft className="w-4 h-4" />}
          >
            Voltar
          </Button>

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Ambiente Seguro Mercado Pago</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Finalizar Assinatura
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Escolha sua forma de pagamento preferida para ativar o plano{' '}
            <strong className="text-slate-800 dark:text-slate-200">{planName}</strong>.
          </p>
        </div>
      </div>

      {/* Widget Principal de Checkout */}
      <CheckoutWidget
        items={defaultItems}
        totalAmount={amountParam}
        externalReference={externalRef}
        defaultCustomer={{
          email: user?.email || 'cliente@tenant.com',
          first_name: user?.name?.split(' ')[0] || 'Cliente',
          last_name: user?.name?.split(' ').slice(1).join(' ') || 'Tenant',
          document_type: 'CPF',
          document_number: '',
        }}
        onSuccess={(orderId) => {
          console.log('[CheckoutPage] Pedido finalizado com sucesso:', orderId);
        }}
      />
    </div>
  );
};

export default CheckoutPage;
