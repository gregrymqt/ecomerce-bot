import React from 'react';
import { CreditCard, QrCode, FileText, CheckCircle2, Clock, XCircle, Download } from 'lucide-react';
import type { Invoice } from '../types/subscription.types';
import { cn } from '@/utils/cn';

export interface InvoiceHistoryTableProps {
  invoices?: Invoice[];
  onDownloadPdf?: (invoice: Invoice) => void;
  className?: string;
}

const DEFAULT_INVOICES: Invoice[] = [
  {
    id: 'inv_982103',
    date: '15/07/2026',
    planName: 'Plano Pro',
    amountFormatted: 'R$ 149,00',
    method: 'credit_card',
    status: 'PAGO',
    pdfUrl: '#',
  },
  {
    id: 'inv_981542',
    date: '15/06/2026',
    planName: 'Plano Pro',
    amountFormatted: 'R$ 149,00',
    method: 'credit_card',
    status: 'PAGO',
    pdfUrl: '#',
  },
  {
    id: 'inv_980119',
    date: '15/05/2026',
    planName: 'Plano Starter',
    amountFormatted: 'R$ 49,00',
    method: 'pix',
    status: 'PAGO',
    pdfUrl: '#',
  },
];

export const InvoiceHistoryTable: React.FC<InvoiceHistoryTableProps> = ({
  invoices = DEFAULT_INVOICES,
  onDownloadPdf,
  className,
}) => {
  const handleDownload = (invoice: Invoice) => {
    if (onDownloadPdf) {
      onDownloadPdf(invoice);
    } else if (invoice.pdfUrl && invoice.pdfUrl !== '#') {
      window.open(invoice.pdfUrl, '_blank');
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border border-gray-800 bg-[#111827] p-6 sm:p-8 shadow-xl space-y-6',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#8B5CF6]" /> Histórico de Faturas & Recibos
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Consulte os recibos e faturas das suas assinaturas recorrentes anteriores.
          </p>
        </div>

        <div className="text-xs text-gray-400 font-mono">
          Total de faturas: <span className="font-bold text-white">{invoices.length}</span>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-xl border border-gray-800 bg-gray-950/40">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80 text-[11px] font-bold uppercase tracking-wider text-gray-400">
              <th className="py-3.5 px-4">Data</th>
              <th className="py-3.5 px-4">Plano</th>
              <th className="py-3.5 px-4">Valor</th>
              <th className="py-3.5 px-4">Método</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-xs">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  Nenhuma fatura encontrada no histórico.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-900/40 transition-colors">
                  {/* DATA */}
                  <td className="py-4 px-4 font-mono font-medium text-gray-200">
                    <div>{invoice.date}</div>
                    <div className="text-[10px] text-gray-500">{invoice.id}</div>
                  </td>

                  {/* PLANO */}
                  <td className="py-4 px-4 font-bold text-white">{invoice.planName}</td>

                  {/* VALOR */}
                  <td className="py-4 px-4 font-extrabold text-gray-100">{invoice.amountFormatted}</td>

                  {/* MÉTODO */}
                  <td className="py-4 px-4 text-gray-300">
                    {invoice.method === 'credit_card' ? (
                      <span className="inline-flex items-center gap-1.5 text-gray-300 font-medium">
                        <CreditCard className="h-4 w-4 text-[#8B5CF6]" />
                        <span>Cartão de Crédito</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-gray-300 font-medium">
                        <QrCode className="h-4 w-4 text-emerald-400" />
                        <span>PIX QR Code</span>
                      </span>
                    )}
                  </td>

                  {/* STATUS */}
                  <td className="py-4 px-4">
                    {invoice.status === 'PAGO' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        PAGO
                      </span>
                    )}

                    {invoice.status === 'PENDENTE' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-400 border border-amber-500/30">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        PENDENTE
                      </span>
                    )}

                    {invoice.status === 'CANCELADO' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-[11px] font-bold text-rose-400 border border-rose-500/30">
                        <XCircle className="h-3.5 w-3.5 text-rose-400" />
                        CANCELADO
                      </span>
                    )}
                  </td>

                  {/* AÇÃO */}
                  <td className="py-4 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => handleDownload(invoice)}
                      title="Download do Recibo em PDF"
                      className="inline-flex items-center justify-center gap-2 h-11 min-h-[44px] px-3.5 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-[0.98] text-gray-200 hover:text-white border border-gray-700 transition-all cursor-pointer font-medium"
                    >
                      <FileText className="h-4 w-4 text-[#8B5CF6]" />
                      <span className="hidden sm:inline">PDF</span>
                      <Download className="h-3.5 w-3.5 text-gray-400" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
