export interface ScenarioDetail {
  label: string;
  tokens: number;
  estimatedCostUsd: number;
  description: string;
}

export interface ProviderCapacityDetail {
  provider: string;
  currentBalanceUsd: number;
  dailyBurnRateTokens: number;
  dailyBurnRateUsd: number;
  growthRatePercent: number;
  runwayDays: number;
  isCritical: boolean;
  recommendedTopupUsd: number;
  scenarios: {
    low: ScenarioDetail;
    recommended: ScenarioDetail;
    safety: ScenarioDetail;
  };
}

export interface ConsolidatedCapacity {
  currentTotalBalanceUsd: number;
  dailyBurnRateTokensTotal: number;
  dailyBurnRateUsdTotal: number;
  consolidatedRunwayDays: number;
  isCritical: boolean;
  recommendedTopupUsd: number;
  scenarios: {
    low: ScenarioDetail;
    recommended: ScenarioDetail;
    safety: ScenarioDetail;
  };
}

export interface AiProviderCredit {
  id: string;
  provider: string;
  amountPaid: number;
  currency: string;
  tokensCredited: number;
  balanceRemaining: number;
  transactionReference?: string;
  source: string;
  notes?: string;
  createdAt: string;
}

export interface AiCapacityOverviewResponse {
  forecastHorizonDays: number;
  generatedAt: string;
  consolidated: ConsolidatedCapacity;
  providers: Record<string, ProviderCapacityDetail>;
  recentTopups: AiProviderCredit[];
}

export interface AiCreditTopupPayload {
  provider: string;
  amountPaid: number;
  currency?: string;
  tokensCredited?: number;
  transactionReference?: string;
  notes?: string;
}
