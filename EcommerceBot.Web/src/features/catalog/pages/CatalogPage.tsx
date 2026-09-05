/**
 * src/features/catalog/pages/CatalogPage.tsx
 *
 * Página principal do Catálogo de Produtos com gerenciamento de IA, scraping e exportação.
 */

import React from 'react';
import {
  CatalogToolbar,
  ProductCatalogTable,
  EditCopyDrawer,
  BulkSyncModal,
  DeleteProductModal,
} from '../components';
import { useCatalogPage } from '../hooks/useCatalogPage';
import { ScraperForm } from '@/features/scraper';
import { Modal } from '@/components/ui/overlay/Modal';
import { Alert } from '@/components/ui/feedback/Alert';
import { SEO } from '@/components/common/SEO';

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
    isBulkSyncModalOpen,
    openBulkSyncModal,
    closeBulkSyncModal,
    deletingProductSku,
    promptDeleteProduct,
    confirmDeleteProduct,
    cancelDeleteProduct,
    regeneratingSku,
    syncingSku,
    isSavingDrawer,
    isApiLoading,
    alertInfo,
    clearAlert,
    handleRegenerateAiTitle,
    handleSyncProduct,
    handleSaveDrawer,
    handleExportBatch,
  } = useCatalogPage();

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 animate-in fade-in duration-300">
      <SEO
        title="Catálogo de Produtos Enriquecidos"
        description="Gerencie, edite e exporte seus produtos de e-commerce enriquecidos por inteligência artificial."
      />

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
        onBulkSyncClick={openBulkSyncModal}
        selectedCount={selectedSkus.length}
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
        onDeleteProduct={promptDeleteProduct}
        isLoading={isApiLoading}
        regeneratingSku={regeneratingSku}
        syncingSku={syncingSku}
      />

      {/* 3. Side Drawer de Edição Fina por IA */}
      <EditCopyDrawer
        key={editingProduct?.sku ?? 'closed'}
        isOpen={!!editingProduct}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSave={handleSaveDrawer}
        isLoading={isSavingDrawer}
      />

      {/* 4. Modal de Sincronização em Lote (Bulk Sync) */}
      <BulkSyncModal
        isOpen={isBulkSyncModalOpen}
        onClose={closeBulkSyncModal}
        selectedSkus={selectedSkus}
      />

      {/* 5. Modal Acessível de Confirmação de Exclusão */}
      <DeleteProductModal
        sku={deletingProductSku}
        isOpen={!!deletingProductSku}
        onClose={cancelDeleteProduct}
        onConfirm={confirmDeleteProduct}
      />

      {/* 6. Modal Acessível de "Nova Ingestão" (Scraper Form) */}
      <Modal
        isOpen={isIngestionModalOpen}
        onClose={closeIngestionModal}
        title="Nova Ingestão de Produto"
        description="Informe a URL da página de produto para extração e enriquecimento automático por IA."
        size="lg"
      >
        <ScraperForm />
      </Modal>
    </div>
  );
};

export default CatalogPage;
