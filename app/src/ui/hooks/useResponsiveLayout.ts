import { useEffect, useState } from 'react';

type ViewportType = 'mobile' | 'desktop';

const MOBILE_MAX_WIDTH = 768;

const getViewportType = (): ViewportType => {
  if (typeof window === 'undefined') {
    return 'desktop';
  }
  return window.innerWidth <= MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
};

export const useResponsiveLayout = (): ViewportType => {
  const [viewport, setViewport] = useState<ViewportType>(getViewportType);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setViewport(getViewportType());
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return viewport;
};
