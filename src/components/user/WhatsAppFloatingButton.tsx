import React from 'react';
import { trackFbEvent } from '@/lib/metaPixel';

export const WhatsAppFloatingButton: React.FC = () => {
  const handleClick = () => {
    trackFbEvent('Lead', { source: 'whatsapp_floating_button', content_name: 'WhatsApp Suporte' });
  };
  return (
    <a
      href="https://wa.me/5548991601025?text=Ol%C3%A1!%20Preciso%20de%20ajuda."
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="fixed bottom-20 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 md:bottom-6 md:right-6 md:h-16 md:w-16"
      style={{ backgroundColor: '#25D366' }}
      aria-label="Falar no WhatsApp"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7 md:h-8 md:w-8" fill="white">
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.129 6.744 3.047 9.381L1.054 31.2l6.012-1.932A15.907 15.907 0 0 0 16.004 32C24.826 32 32 24.822 32 16.004 32 7.176 24.826 0 16.004 0zm9.35 22.604c-.396 1.116-1.954 2.042-3.21 2.312-.862.182-1.986.328-5.774-1.242-4.848-2.008-7.966-6.93-8.208-7.252-.232-.322-1.95-2.6-1.95-4.96s1.234-3.518 1.672-3.998c.438-.48.958-.6 1.278-.6.318 0 .638.002.916.016.294.016.688-.112 1.078.822.396.952 1.354 3.312 1.472 3.552.12.24.2.52.04.838-.16.322-.24.52-.48.802-.24.28-.504.626-.72.84-.24.24-.49.502-.21.982.28.48 1.244 2.054 2.672 3.328 1.836 1.638 3.384 2.146 3.864 2.386.48.24.76.2 1.04-.12.28-.322 1.2-1.4 1.52-1.88.32-.48.64-.398 1.078-.24.44.16 2.794 1.318 3.274 1.558.48.24.798.36.918.558.118.2.118 1.14-.278 2.254z" />
      </svg>
    </a>
  );
};
