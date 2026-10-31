'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

type RevealProps = { children: ReactNode; className?: string; delay?: number };
type RevealStyle = CSSProperties & { '--reveal-delay': string };

export function Reveal({ children, className = '', delay = 0 }: RevealProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setShown(true);
        observer.disconnect();
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });

    setArmed(true);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const style: RevealStyle = { '--reveal-delay': `${delay}ms` };
  return <div ref={elementRef} style={style} className={`reveal ${armed ? 'reveal--armed' : ''} ${shown ? 'reveal--shown' : ''} ${className}`}>{children}</div>;
}
