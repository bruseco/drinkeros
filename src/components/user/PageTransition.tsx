import React, { useRef, useEffect, useState } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitionClass, setTransitionClass] = useState('page-enter');
  const prevKeyRef = useRef(location.key);
  const disableWrapper =
    location.pathname === '/app/receitas' ||
    location.pathname.startsWith('/app/receita/') ||
    location.pathname.startsWith('/app/batalha') ||
    location.pathname === '/clube';

  useEffect(() => {
    if (disableWrapper || location.key === prevKeyRef.current) return;

    const isPop = navigationType === 'POP';
    // PUSH: nova tela entra pela direita, atual sai para a esquerda
    // POP: nova tela entra pela esquerda, atual sai para a direita
    const exitClass = isPop ? 'page-exit-right' : 'page-exit-left';
    const enterClass = isPop ? 'page-enter-left' : 'page-enter-right';

    setTransitionClass(exitClass);

    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionClass(enterClass);
      prevKeyRef.current = location.key;
    }, 220);

    return () => clearTimeout(timeout);
  }, [location.key, navigationType, children, disableWrapper]);

  if (disableWrapper) {
    return <>{children}</>;
  }

  return (
    <div className={`page-transition ${transitionClass}`}>
      {displayChildren}
    </div>
  );
};
