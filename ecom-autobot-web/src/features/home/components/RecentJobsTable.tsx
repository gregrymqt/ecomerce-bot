import React from 'react';
import { Eye, Download, CheckCircle2, Clock, XCircle, Globe, Cpu } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Card, Badge, Table, Button, type TableColumn } from '@/components/ui';
import { type ExtractionJob, type JobStatus, MOCK_EXTRACTION_JOBS } from '../types/home.types';

export interface RecentJobsTableProps {
  jobs?: ExtractionJob[];
  onViewJob?: (job: ExtractionJob) => void;
  onExportJob?: (job: ExtractionJob) => void;
  className?: string;
}

const renderStatusBadge = (status: JobStatus) => {
  switch (status) {
    case 'Sucesso':
      return (
        <Badge variant="success" icon={<CheckCircle2 className="w-3.5 h-3.5" />}>
          Sucesso
        </Badge>
      );
    case 'Processando':
      return (
        <Badge variant="warning" icon={<Clock className="w-3.5 h-3.5 animate-spin" />}>
          Processando
        </Badge>
      );
    case 'Erro':
      return (
        <Badge variant="error" icon={<XCircle className="w-3.5 h-3.5" />}>
          Erro
        </Badge>
      );
    default:
      return null;
  }
};

export const RecentJobsTable: React.FC<RecentJobsTableProps> = ({
  jobs = MOCK_EXTRACTION_JOBS,
  onViewJob,
  onExportJob,
  className,
}) => {
  const columns: TableColumn<ExtractionJob>[] = [
    {
      key: 'productName',
      header: 'PRODUTO',
      className: 'font-medium text-white max-w-[240px] sm:max-w-xs truncate',
      render: (job) => job.productName,
    },
    {
      key: 'sourceDomain',
      header: 'ORIGEM',
      className: 'text-slate-400',
      render: (job) => (
        <div className="flex items-center gap-1.5 text-xs">
          <Globe className="w-3.5 h-3.5 text-slate-500" />
          <span>{job.sourceDomain}</span>
        </div>
      ),
    },
    {
      key: 'aiModel',
      header: 'MODELO AI',
      className: 'text-slate-300',
      render: (job) => (
        <div className="flex items-center gap-1.5 text-xs font-mono">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span>{job.aiModel}</span>
        </div>
      ),
    },
    {
      key: 'status',
      header: 'STATUS',
      render: (job) => renderStatusBadge(job.status),
    },
    {
      key: 'actions',
      header: 'AÇÕES',
      align: 'right',
      render: (job) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onViewJob?.(job);
            }}
            title="Ver Detalhes do Produto"
            aria-label="Ver Detalhes"
            iconLeft={<Eye className="w-4 h-4 text-slate-400" />}
            className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 text-slate-400 hover:text-white"
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onExportJob?.(job);
            }}
            disabled={job.status !== 'Sucesso'}
            title={
              job.status === 'Sucesso'
                ? 'Exportar CSV / Shopify'
                : 'Exportação indisponível para este status'
            }
            aria-label="Exportar Produto"
            iconLeft={<Download className="w-4 h-4" />}
            className="h-11 w-11 min-h-[44px] min-w-[44px] p-0 text-slate-400 hover:text-purple-300 disabled:opacity-30"
          />
        </div>
      ),
    },
  ];

  return (
    <Card
      glass
      className={cn(
        'border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-slate-950/40 space-y-4',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-white">Extrações Recentes</h3>
          <p className="text-xs text-slate-400">
            Histórico das últimas requisições de raspagem e enriquecimento
          </p>
        </div>
        <Badge variant="default" className="bg-slate-800 text-slate-300 border-slate-700">
          {jobs.length} itens
        </Badge>
      </div>

      <Table<ExtractionJob>
        columns={columns}
        data={jobs}
        keyExtractor={(job) => job.id}
        emptyMessage="Nenhuma extração recente encontrada."
        className="bg-transparent border-slate-800/80"
      />
    </Card>
  );
};

export default RecentJobsTable;
