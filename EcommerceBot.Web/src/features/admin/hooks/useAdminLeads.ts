/**
 * src/features/admin/hooks/useAdminLeads.ts
 *
 * Hook de gerenciamento de estado e operações do Mini-CRM de Leads Enterprise.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { adminLeadsService } from '../services/adminLeads.service';
import type {
  EnterpriseLead,
  EnterpriseLeadsSummaryMetrics,
} from '../types/leads.types';
import { getErrorMessage } from '@/utils/errors';

export type ViewMode = 'kanban' | 'table';

export const useAdminLeads = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [leads, setLeads] = useState<EnterpriseLead[]>([]);
  const [metrics, setMetrics] = useState<EnterpriseLeadsSummaryMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros e busca
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');

  // Modal de Detalhes / Anotações
  const [selectedLead, setSelectedLead] = useState<EnterpriseLead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [notesInput, setNotesInput] = useState<string>('');
  const [statusSelect, setStatusSelect] = useState<string>('PENDING');
  const [isSavingNotes, setIsSavingNotes] = useState<boolean>(false);
  const [saveNotesError, setSaveNotesError] = useState<string | null>(null);

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminLeadsService.getLeads(
        selectedStatusFilter !== 'ALL' ? selectedStatusFilter : undefined,
        searchQuery || undefined
      );
      setLeads(data.leads || []);
      setMetrics(data.metrics || null);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao carregar leads do CRM.');
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [selectedStatusFilter, searchQuery]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const q = searchQuery.toLowerCase();
    return leads.filter(
      (l) =>
        l.email.toLowerCase().includes(q) ||
        (l.companyName && l.companyName.toLowerCase().includes(q)) ||
        (l.phone && l.phone.includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q))
    );
  }, [leads, searchQuery]);

  const handleOpenDetailModal = (lead: EnterpriseLead) => {
    setSelectedLead(lead);
    setNotesInput(lead.internalNotes || '');
    setStatusSelect(lead.status);
    setSaveNotesError(null);
    setIsDetailModalOpen(true);
  };

  const handleSaveLeadDetails = async () => {
    if (!selectedLead) return;
    setIsSavingNotes(true);
    setSaveNotesError(null);
    try {
      await adminLeadsService.updateStatus(selectedLead.id, {
        status: statusSelect,
        internalNotes: notesInput,
      });
      setIsDetailModalOpen(false);
      await fetchLeads();
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'Erro ao salvar anotações do lead.');
      setSaveNotesError(msg);
    } finally {
      setIsSavingNotes(false);
    }
  };

  return {
    viewMode,
    setViewMode,
    leads,
    metrics,
    isLoading,
    error,
    searchQuery,
    setSearchQuery,
    selectedStatusFilter,
    setSelectedStatusFilter,
    filteredLeads,
    selectedLead,
    setSelectedLead,
    isDetailModalOpen,
    setIsDetailModalOpen,
    notesInput,
    setNotesInput,
    statusSelect,
    setStatusSelect,
    isSavingNotes,
    saveNotesError,
    fetchLeads,
    handleOpenDetailModal,
    handleSaveLeadDetails,
  };
};

export default useAdminLeads;
