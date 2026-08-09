import React from 'react';
import { CreditCard, QrCode, FileText, Download } from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';
import type { Invoice } from '@/features/subscription';
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
    <Card
      className={cn(
        'border-gray-800 bg-[#111827] shadow-xl space-y-6',
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#8B5CF6]" /> Histórico de Faturas & Recibos
          </h3>
          <p className="text-xs text-gray-400 mt-1 font-mono">
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
            <tr className="border-b border-gray-800 bg-gray-900/80 text-[11px] font-bold uppercase tracking-wider text-gray-400 font-mono">
              <th className="py-3.5 px-4 font-mono uppercase">Data</th>
              <th className="py-3.5 px-4 font-mono uppercase">Plano</th>
              <th className="py-3.5 px-4 font-mono uppercase">Valor</th>
              <th className="py-3.5 px-4 font-mono uppercase">Método</th>
              <th className="py-3.5 px-4 font-mono uppercase">Status</th>
              <th className="py-3.5 px-4 text-right font-mono uppercase">Ação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 text-xs">
            {invoices.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 font-mono">
                  Nenhuma fatura encontrada no histórico.
                </td>
              </tr>
            ) : (
              invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-900/40 transition-colors">
                  {/* DATA */}
                  <td className="py-4 px-4 font-mono font-medium text-gray-200">
                    <div>{invoice.date}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{invoice.id}</div>
                  </td>

                  {/* PLANO */}
                  <td className="py-4 px-4 font-bold text-white">{invoice.planName}</td>

                  {/* VALOR */}
                  <td className="py-4 px-4 font-extrabold text-gray-100 font-mono">{invoice.amountFormatted}</td>

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
                      <Badge variant="success" dot>
                        PAGO
                      </Badge>
                    )}

                    {invoice.status === 'PENDENTE' && (
                      <Badge variant="warning" dot>
                        PENDENTE
                      </Badge>
                    )}

                    {invoice.status === 'CANCELADO' && (
                      <Badge variant="error" dot>
                        CANCELADO
                      </Badge>
                    )}
                  </td>

                  {/* AÇÃO */}
                  <td className="py-4 px-4 text-right">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => handleDownload(invoice)}
                      title="Download do Recibo em PDF"
                      iconLeft={<FileText className="h-4 w-4 text-[#8B5CF6]" />}
                      iconRight={<Download className="h-3.5 w-3.5 text-gray-400" />}
                    >
                      <span className="hidden sm:inline">PDF</span>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
};

