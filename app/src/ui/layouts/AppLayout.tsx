import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthStatusBar } from '@features/logiin';
import { GlobalHeader } from '../components/GlobalHeader';
import { AppNavigation } from '../components/AppNav';
import { useResponsiveLayout } from '../hooks/useResponsiveLayout';

export const AppLayout: React.FC = () => {
  const viewport = useResponsiveLayout();
  const [isNavOverlayOpen, setNavOverlayOpen] = useState(false);

  useEffect(() => {
    if (viewport === 'desktop' && isNavOverlayOpen) {
      setNavOverlayOpen(false);
    }
  }, [viewport, isNavOverlayOpen]);

  const isMobile = viewport === 'mobile';

  return (
    <>
      <div className="app-shell">
        <aside className="app-shell__sidebar">
          <div className="app-shell__sidebar-header">
            <span className="app-shell__product">forge</span>
          </div>
          <AppNavigation variant="sidebar" />
          <AuthStatusBar />
        </aside>
        <div className="app-shell__main">
          <GlobalHeader
            showMenuButton={isMobile}
            isMenuOpen={isNavOverlayOpen}
            onMenuButtonClick={() => setNavOverlayOpen(true)}
          />
          <div className="app-shell__content">
            <Outlet />
          </div>
        </div>
      </div>
      <AppNavigation variant="overlay" open={isNavOverlayOpen} onOpenChange={setNavOverlayOpen} />
    </>
  );
};
