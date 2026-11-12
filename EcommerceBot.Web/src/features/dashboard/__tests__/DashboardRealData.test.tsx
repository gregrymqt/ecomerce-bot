import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { apiClient } from '@/lib/apiClient';
import { dashboardService } from '../services/dashboard.service';
import { DashboardKpiGrid } from '../components/DashboardKpiGrid';
import { VolumePerformanceChart } from '../components/VolumePerformanceChart';
import { TokenTelemetryCard } from '../components/TokenTelemetryCard';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { SystemHealthWidget } from '../components/SystemHealthWidget';

vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('Dashboard Real Data & Anti-Mock Regression (UX-03)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('componentes de Dashboard não devem exibir números fake quando API retornar vazio', () => {
    render(
      <div>
        <DashboardKpiGrid metrics={null} />
        <VolumePerformanceChart items={[]} period="WEEK" onPeriodChange={vi.fn()} />
        <TokenTelemetryCard providers={[]} averageLatencyMs={0} />
        <RecentActivityTable activities={[]} />
        <SystemHealthWidget healthItems={[]} />
      </div>
    );

    expect(screen.queryByText('1.284')).not.toBeInTheDocument();
    expect(screen.queryByText('98.5%')).not.toBeInTheDocument();
    expect(screen.queryByText('8.500')).not.toBeInTheDocument();
    expect(screen.queryByText('10.000')).not.toBeInTheDocument();
    expect(screen.queryByText('DeepSeek V3 (BYOK)')).not.toBeInTheDocument();
    expect(screen.queryByText('Smartphone Galaxy S24 Ultra 512GB')).not.toBeInTheDocument();

    expect(screen.getByText(/Nenhum volume registrado neste período/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum consumo de tokens registrado/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma atividade de robô registrada/i)).toBeInTheDocument();
    expect(screen.getByText(/Nenhuma leitura de saúde disponível/i)).toBeInTheDocument();
  });

  it('Card 4 do DashboardKpiGrid deve exibir Créditos Restantes (credits_remaining / credits_total)', () => {
    render(
      <DashboardKpiGrid
        metrics={{
          total_extracted: 40,
          growth_percentage: 0,
          success_rate_percentage: 95,
          estimated_hours_saved: 6.4,
          credits_remaining: 25,
          credits_total: 100,
        }}
      />
    );

    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('/ 100')).toBeInTheDocument();
  });

  it('dashboardService.getTelemetry deve mapear contrato real da Core API (.NET)', async () => {
    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url === '/api/v1/system/telemetry') {
        return Promise.resolve({
          data: {
            productStatus: { raw: 2, processing: 1, processed: 7, failed: 0 },
            tokenUsage: [
              {
                provider: 'OPENROUTER',
                totalPromptTokens: 1200,
                totalCompletionTokens: 800,
                totalTokens: 2000,
                isByok: true,
              },
            ],
            averageLatencyMs: 340,
            hoursSaved: 1.12,
            creditsBalance: 42,
            creditsTotal: 50,
            volumeChart: [{ label: '11/11', rawCount: 10, processedCount: 7 }],
          },
        });
      }
      if (url === '/api/v1/system/activities') {
        return Promise.resolve({
          data: [
            {
              id: 'act-1',
              workerType: 'ProductEnricher',
              status: 'SUCCESS',
              detailsJson: JSON.stringify({ title: 'Camisa Linho', domain: 'loja.com', ai_provider: 'OpenRouter' }),
              createdAt: new Date().toISOString(),
            },
          ],
        });
      }
      return Promise.resolve({
        data: { status: 'OK', services: { SQLServer: 'UP', Redis: 'UP' } },
      });
    });

    const telemetry = await dashboardService.getTelemetry('WEEK');

    expect(telemetry.kpis.total_extracted).toBe(10);
    expect(telemetry.kpis.success_rate_percentage).toBe(100);
    expect(telemetry.kpis.credits_remaining).toBe(42);
    expect(telemetry.kpis.credits_total).toBe(50);
    expect(telemetry.chart_data).toEqual([{ label: '11/11', raw_count: 10, processed_count: 7 }]);
    expect(telemetry.token_telemetry[0]).toMatchObject({
      provider_name: 'OPENROUTER (BYOK)',
      used_tokens_display: '2.0K',
      is_byok: true,
    });
    expect(telemetry.recent_activities[0].product_title).toBe('Camisa Linho');
    expect(telemetry.system_health).toHaveLength(2);
  });
});
