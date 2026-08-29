/**
 * src/features/home/services/home.service.ts
 *
 * Camada de serviços puros e utilitários de negócio para a feature Home.
 * Implementa cálculo de métricas de catálogo, mapeamento de jobs e exportação de CSV.
 */

import type { Product } from '@/features/catalog';
import type { ExtractionJob, HomeMetrics, JobStatus } from '../types/home.types';

export const homeService = {
  /**
   * Calcula as métricas consolidadas de desempenho a partir dos produtos do catálogo.
   *
   * @param products Lista de produtos do tenant
   */
  calculateMetrics: (products: Product[]): HomeMetrics => {
    const total = products.length;
    const processed = products.filter((p) =>
      ['PROCESSED', 'EXPORTED'].includes(String(p.status).toUpperCase())
    ).length;
    const active = products.filter((p) =>
      ['PROCESSING', 'RAW'].includes(String(p.status).toUpperCase())
    ).length;
    const failed = products.filter((p) =>
      String(p.status).toUpperCase() === 'FAILED'
    ).length;

    const denominator = processed + failed;
    const successRate = denominator > 0 ? (processed / denominator) * 100 : total > 0 ? 100 : 100;

    return {
      aiCreditsUsed: processed * 5,
      aiCreditsTotal: 5000,
      productsProcessedMonth: processed,
      activeJobsCount: active,
      successRate,
    };
  },

  /**
   * Mapeia os produtos do catálogo para a lista de jobs recentes na Home.
   *
   * @param products Lista de produtos do tenant
   * @param limit Limite máximo de jobs a retornar (padrão 10)
   */
  mapProductsToJobs: (products: Product[], limit: number = 10): ExtractionJob[] => {
    return products.slice(0, limit).map((p, idx) => {
      let status: JobStatus = 'Processando';
      const st = String(p.status).toUpperCase();
      if (st === 'PROCESSED' || st === 'EXPORTED') {
        status = 'Sucesso';
      } else if (st === 'FAILED') {
        status = 'Erro';
      }

      let sourceDomain = 'e-commerce';
      const productUrl =
        (p.attributes?.url as string) ||
        (p.attributes?.source_url as string) ||
        '';

      if (productUrl) {
        try {
          sourceDomain = new URL(productUrl).hostname;
        } catch {
          // fallback silencioso
        }
      } else if (p.sku.startsWith('SHP')) {
        sourceDomain = 'shopify';
      } else if (p.sku.startsWith('NUV')) {
        sourceDomain = 'nuvemshop';
      }

      return {
        id: `job-${p.sku}-${idx}`,
        sku: p.sku,
        productName: p.title || p.sku,
        sourceDomain,
        aiModel: 'DeepSeek V3',
        status,
        createdAt: p.created_at || new Date().toISOString(),
        productUrl: productUrl || undefined,
      };
    });
  },

  /**
   * Realiza a exportação dos dados de um job em formato CSV com download direto no navegador.
   *
   * @param job Job de extração para exportação
   */
  exportJobAsCsv: (job: ExtractionJob): void => {
    const headers = ['ID', 'SKU', 'Produto', 'Origem', 'Modelo AI', 'Status', 'Data Criacao'];
    const rows = [
      [
        job.id,
        job.sku || 'N/A',
        `"${job.productName.replace(/"/g, '""')}"`,
        job.sourceDomain,
        job.aiModel,
        job.status,
        job.createdAt,
      ],
    ];

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(';'), ...rows.map((e) => e.join(';'))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `extracao_${job.sku || job.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

export default homeService;
