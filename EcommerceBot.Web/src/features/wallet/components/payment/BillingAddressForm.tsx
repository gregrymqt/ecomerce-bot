/**
 * src/features/wallet/components/payment/BillingAddressForm.tsx
 *
 * Formulário atômico para coleta de dados fiscais (CPF/CNPJ) e endereço.
 * Suporta autopreenchimento dinâmico de endereço por CEP (ViaCEP),
 * máscaras de documento e touch targets >= 44px.
 */

import React, { useState } from 'react';
import { Search, Loader2, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type {
  TenantBillingProfile,
  UpsertTenantBillingProfilePayload,
  ViaCepAddressResponse,
} from '../../types/billing.type';

export interface BillingAddressFormProps {
  initialProfile?: TenantBillingProfile | null;
  loading?: boolean;
  onSave: (payload: UpsertTenantBillingProfilePayload) => Promise<void>;
  onCancel?: () => void;
  onLookupCep: (cep: string) => Promise<ViaCepAddressResponse | null>;
  cepLoading?: boolean;
  className?: string;
  submitButtonText?: string;
}

export const BillingAddressForm: React.FC<BillingAddressFormProps> = ({
  initialProfile,
  loading = false,
  onSave,
  onCancel,
  onLookupCep,
  cepLoading = false,
  className = '',
  submitButtonText = 'Salvar e Continuar',
}) => {
  const [legalName, setLegalName] = useState(initialProfile?.legal_name || '');
  const [docNumber, setDocNumber] = useState(initialProfile?.document_number || '');
  const [zipCode, setZipCode] = useState(initialProfile?.zip_code || '');
  const [streetName, setStreetName] = useState(initialProfile?.street_name || '');
  const [streetNumber, setStreetNumber] = useState(initialProfile?.street_number || '');
  const [complement, setComplement] = useState(initialProfile?.complement || '');
  const [neighborhood, setNeighborhood] = useState(initialProfile?.neighborhood || '');
  const [city, setCity] = useState(initialProfile?.city || '');
  const [federalUnit, setFederalUnit] = useState(initialProfile?.federal_unit || '');
  const [formError, setFormError] = useState<string | null>(null);

  // Formata Documento (CPF: 000.000.000-00 ou CNPJ: 00.000.000/0000-00)
  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 14);
    if (raw.length <= 11) {
      // Máscara CPF
      const masked = raw
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      setDocNumber(masked);
    } else {
      // Máscara CNPJ
      const masked = raw
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
      setDocNumber(masked);
    }
  };

  // Formata CEP (00000-000) e busca endereço
  const handleZipChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 8);
    const masked = raw.replace(/^(\d{5})(\d)/, '$1-$2');
    setZipCode(masked);

    if (raw.length === 8) {
      const address = await onLookupCep(raw);
      if (address && !address.erro) {
        setStreetName(address.logradouro || '');
        setNeighborhood(address.bairro || '');
        setCity(address.localidade || '');
        setFederalUnit(address.uf || '');
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanDoc = docNumber.replace(/\D/g, '');
    const cleanZip = zipCode.replace(/\D/g, '');

    if (!legalName.trim()) {
      setFormError('Informe o nome completo ou razão social.');
      return;
    }

    if (cleanDoc.length !== 11 && cleanDoc.length !== 14) {
      setFormError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.');
      return;
    }

    if (cleanZip.length !== 8) {
      setFormError('Informe um CEP válido com 8 dígitos.');
      return;
    }

    if (!streetName.trim()) {
      setFormError('Informe o logradouro/rua.');
      return;
    }

    if (!streetNumber.trim()) {
      setFormError('Informe o número ou "S/N".');
      return;
    }

    if (!neighborhood.trim()) {
      setFormError('Informe o bairro.');
      return;
    }

    if (!city.trim() || !federalUnit.trim()) {
      setFormError('Informe a cidade e o estado (UF).');
      return;
    }

    const docType = cleanDoc.length === 14 ? 'CNPJ' : 'CPF';

    await onSave({
      legal_name: legalName.trim(),
      document_type: docType,
      document_number: cleanDoc,
      zip_code: cleanZip,
      street_name: streetName.trim(),
      street_number: streetNumber.trim(),
      complement: complement.trim() || null,
      neighborhood: neighborhood.trim(),
      city: city.trim(),
      federal_unit: federalUnit.trim().toUpperCase(),
    });
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-4 text-slate-100 ${className}`}>
      {formError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Nome / Razão Social */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Nome Completo ou Razão Social <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={legalName}
            onChange={(e) => setLegalName(e.target.value)}
            placeholder="Ex: João da Silva ou Minha Loja Ltda"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>

        {/* CPF / CNPJ */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            CPF ou CNPJ <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={docNumber}
            onChange={handleDocChange}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>
      </div>

      {/* CEP com Busca */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
            <span>CEP <span className="text-rose-400">*</span></span>
            {cepLoading && (
              <span className="text-[11px] text-indigo-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Buscando...
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              required
              value={zipCode}
              onChange={handleZipChange}
              placeholder="00000-000"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
              <Search className="w-4 h-4" />
            </div>
          </div>
        </div>

        <div className="sm:col-span-2 space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Logradouro / Rua <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={streetName}
            onChange={(e) => setStreetName(e.target.value)}
            placeholder="Ex: Av. Paulista"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>
      </div>

      {/* Número, Complemento e Bairro */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Número <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={streetNumber}
            onChange={(e) => setStreetNumber(e.target.value)}
            placeholder="Ex: 1000 ou S/N"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Complemento <span className="text-slate-500">(opcional)</span>
          </label>
          <input
            type="text"
            value={complement}
            onChange={(e) => setComplement(e.target.value)}
            placeholder="Ex: Sala 42, Bloco B"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Bairro <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={neighborhood}
            onChange={(e) => setNeighborhood(e.target.value)}
            placeholder="Ex: Bela Vista"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>
      </div>

      {/* Cidade e Estado (UF) */}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Cidade <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="Ex: São Paulo"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            UF <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            required
            maxLength={2}
            value={federalUnit}
            onChange={(e) => setFederalUnit(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="SP"
            className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-lg text-white text-center font-mono placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-base sm:text-sm min-h-[44px]"
          />
        </div>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={onCancel}
            disabled={loading}
            className="border-slate-700 text-slate-300 min-h-[44px]"
          >
            Voltar
          </Button>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          isLoading={loading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white min-h-[44px]"
        >
          <Check className="w-4 h-4 mr-1.5" />
          {submitButtonText}
        </Button>
      </div>
    </form>
  );
};

export default BillingAddressForm;
