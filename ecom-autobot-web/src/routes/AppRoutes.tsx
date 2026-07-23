import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthPage } from '@/features/auth';
import { LiveDemoPage } from '@/features/live-demo';

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Rota Pública de Autenticação */}
      <Route path="/auth" element={<AuthPage />} />

      {/* Rotas com Layout Principal e Sidebar */}
      <Route element={<MainLayout />}>
        <Route path="/demo" element={<LiveDemoPage />} />
        
        {/* Redirecionamento da Raiz para a Demo */}
        <Route path="/" element={<Navigate to="/demo" replace />} />
      </Route>

      {/* Rota Fallback para URLs desconhecidas */}
      <Route path="*" element={<Navigate to="/demo" replace />} />
    </Routes>
  );
};

export default AppRoutes;
