import { useState, useCallback, useEffect } from 'react';
import { productService } from '../services/product.service';
import type {
  Product,
  ProductStatus,
  ProductUpdatePayload,
} from '../types/product.type';
import { getErrorMessage } from '@/utils/errors';

export function useProducts(initialLimit = 20) {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(initialLimit);
  const [pages, setPages] = useState(1);

  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * Carrega a lista paginada de produtos a partir da API.
   */
  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await productService.getProducts({
        status: statusFilter || undefined,
        search: searchTerm || undefined,
        page,
        limit,
      });
      setProducts(data.items || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao carregar lista de produtos.'));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, searchTerm, page, limit]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  /**
   * Executa a atualização de um produto pelo SKU.
   */
  const updateProduct = async (sku: string, payload: ProductUpdatePayload): Promise<boolean> => {
    setIsUpdating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await productService.updateProduct(sku, payload);
      setSuccessMessage(`Produto '${sku}' atualizado com sucesso!`);
      await fetchProducts();
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao atualizar produto.'));
      return false;
    } finally {
      setIsUpdating(false);
    }
  };

  /**
   * Remove um produto pelo SKU.
   */
  const deleteProduct = async (sku: string): Promise<boolean> => {
    setIsDeleting(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await productService.deleteProduct(sku);
      setSuccessMessage(`Produto '${sku}' removido com sucesso!`);
      // Se for o único item da página atual, volta uma página se possível
      if (products.length === 1 && page > 1) {
        setPage((prev) => prev - 1);
      } else {
        await fetchProducts();
      }
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Erro ao remover produto.'));
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearchChange = (term: string) => {
    setSearchTerm(term);
    setPage(1);
  };

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  return {
    products,
    total,
    page,
    limit,
    pages,
    statusFilter,
    searchTerm,
    isLoading,
    isUpdating,
    isDeleting,
    error,
    successMessage,
    setPage,
    setLimit,
    setSearchTerm: handleSearchChange,
    setStatusFilter: handleStatusFilterChange,
    refetch: fetchProducts,
    updateProduct,
    deleteProduct,
    clearMessages: () => {
      setError(null);
      setSuccessMessage(null);
    },
  };
}
