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

  useEffect(() => {
    if (location.key === prevKeyRef.current) return;

    const isPop = navigationType === 'POP';
    const exitClass = isPop ? 'page-exit-right' : 'page-exit-left';
    const enterClass = isPop ? 'page-enter-left' : 'page-enter-right';

    // Start exit animation on current content
    setTransitionClass(exitClass);

    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setTransitionClass(enterClass);
      prevKeyRef.current = location.key;
    }, 150); // match CSS duration

    return () => clearTimeout(timeout);
  }, [location.key, navigationType, children]);

  return (
    <div className={`page-transition ${transitionClass}`}>
      {displayChildren}
    </div>
  );
};
