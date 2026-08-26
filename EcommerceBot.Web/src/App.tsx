import { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth';
import { AppRoutes } from '@/routes/AppRoutes';
import { JsonLd } from '@/components/common/JsonLd';
import { initGA } from '@/lib/analytics';
import { initClarity } from '@/lib/clarity';

const websiteSchemaData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'E-Commerce AutoBot',
  url: 'https://ecommercebot.com',
  description: 'Plataforma inteligente para extração automática, enriquecimento via IA e exportação/sincronização de catálogos de produtos de e-commerce.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  inLanguage: 'pt-BR',
};

export default function App() {
  useEffect(() => {
    initGA();
    initClarity();
  }, []);

  return (
    <AuthProvider>
      <JsonLd data={websiteSchemaData} />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
