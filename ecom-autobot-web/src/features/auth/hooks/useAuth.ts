import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';

/**
 * Hook customizado para consumir o AuthContext com validação e utilitários derivados.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser utilizado obrigatoriamente dentro de um AuthProvider.');
  }

  return {
    ...context,
    isAuthenticated: context.status === 'authenticated',
    hasTenants: Boolean(context.user?.tenants && context.user.tenants.length > 0),
  };
};
