import React from 'react';
import { CourseLanding } from '@/components/landing/CourseLanding';
import { Layout } from '@/components/layout/Layout';

const BartenderABordo = () => {
  return (
    <Layout>
      <div style={{ marginTop: '-10px' }}>
        <CourseLanding
          title="Bartender a Bordo"
          subtitle="Domine a arte da coquetelaria profissional e transforme sua paixão em uma carreira de sucesso."
          price="R$ 497,00"
          originalPrice="R$ 997,00"
          videoUrl="https://www.youtube.com/embed/dQw4w9WgXcQ"
          features={[
            "Mais de 50 videoaulas exclusivas",
            "Certificado de conclusão reconhecido",
            "Suporte direto com especialistas",
            "Acesso vitalício ao conteúdo"
          ]}
          logoWrapperClassName="-mt-10 sm:-mt-16 mb-0"
        />
      </div>
    </Layout>
  );
};

export default BartenderABordo;
