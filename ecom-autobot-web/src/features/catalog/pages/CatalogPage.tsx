import React from 'react';
import { CatalogToolbar } from '../components/CatalogToolbar';
import { ProductCatalogTable } from '../components/ProductCatalogTable';
import { EditCopyDrawer } from '../components/EditCopyDrawer';
import { ScraperForm } from '@/features/scraper';
import { X, Sparkles } from 'lucide-react';
import { useCatalogPage } from '../hooks/useCatalogPage';
import { Alert } from '@/components/ui/feedback/Alert';

export const CatalogPage: React.FC = () => {
  const {
    filteredProducts,
    totalCount,
    searchTerm,
    setSearchTerm,
    statusFilter,
    setStatusFilter,
    selectedSkus,
    handleSelectSku,
    handleSelectAll,
    editingProduct,
    setEditingProduct,
    isIngestionModalOpen,
    openIngestionModal,
    closeIngestionModal,
    regeneratingSku,
    syncingSku,
    deletingSku,
    isSavingDrawer,
    isApiLoading,
    alertInfo,
    clearAlert,
    handleRegenerateAiTitle,
    handleSyncProduct,
    handleDeleteProduct,
    handleSaveDrawer,
    handleExportBatch,
  } = useCatalogPage();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      {/* Alerta de Feedback Customizado */}
      {alertInfo && (
        <Alert
          variant={alertInfo.variant}
          title={alertInfo.title}
          onClose={clearAlert}
        >
          {alertInfo.message}
        </Alert>
      )}

      {/* 1. Toolbar Principal & Filtros Rápidos */}
      <CatalogToolbar
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        onNewIngestionClick={openIngestionModal}
        onExportBatchClick={handleExportBatch}
        totalCount={totalCount}
      />

      {/* 2. Tabela Principal de Produtos */}
      <ProductCatalogTable
        products={filteredProducts}
        selectedSkus={selectedSkus}
        onSelectSku={handleSelectSku}
        onSelectAll={handleSelectAll}
        onEditProduct={(product) => setEditingProduct(product)}
        onRegenerateAiTitle={handleRegenerateAiTitle}
        onSyncProduct={handleSyncProduct}
        onDeleteProduct={handleDeleteProduct}
        isLoading={isApiLoading}
        regeneratingSku={regeneratingSku}
        syncingSku={syncingSku}
        deletingSku={deletingSku}
      />

      {/* 3. Side Drawer de Edição Fina por IA */}
      <EditCopyDrawer
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveDrawer}
        isLoading={isSavingDrawer}
      />

      {/* 4. Modal de "Nova Ingestão" (Scraper Form) */}
      {isIngestionModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl bg-[#15121B] rounded-2xl border border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <h2 className="text-lg font-bold text-slate-100">
                  Nova Ingestão de Produto
                </h2>
              </div>
              <button
                onClick={closeIngestionModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <ScraperForm />
          </div>
        </div>
      )}
    </div>
  );
};

export default CatalogPage;
