/**
 * src/features/wallet/types/billing.type.ts
 *
 * Contratos de tipos para o perfil de faturamento, identificação fiscal (CPF/CNPJ)
 * e endereço da organização no ecossistema SaaS.
 */

export type DocumentType = 'CPF' | 'CNPJ';

export interface TenantBillingProfile {
  id: string;
  tenant_id: string;
  legal_name: string;
  trade_name?: string | null;
  document_type: DocumentType;
  document_number: string;
  document_number_masked: string;
  email?: string | null;
  phone?: string | null;
  zip_code: string;
  street_name: string;
  street_number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  federal_unit: string;
  updated_at: string;
}

export interface UpsertTenantBillingProfilePayload {
  legal_name: string;
  trade_name?: string | null;
  document_type: DocumentType;
  document_number: string;
  email?: string | null;
  phone?: string | null;
  zip_code: string;
  street_name: string;
  street_number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  federal_unit: string;
}

export interface ViaCepAddressResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}
