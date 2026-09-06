/**
 * src/features/auth/context/AuthContext.tsx
 *
 * Provider de Autenticação e Multi-Tenancy.
 * Todo gerenciamento de sessão JWT, multi-tenancy e chamadas de serviço
 * são delegados ao hook useAuthSession seguindo o padrão de 4 camadas.
 */

import React from 'react';
import { useAuthSession } from '../hooks/useAuthSession';
import { AuthContext } from './AuthContextDefinition';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const auth = useAuthSession();

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;