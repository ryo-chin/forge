import { AuthStatusBar } from '@features/logiin';
import type React from 'react';
import { useEffect } from 'react';
import { NavLink } from 'react-router-dom';

type NavListProps = {
  onSelect?: () => void;
};

const AppNavList: React.FC<NavListProps> = ({ onSelect }) => {
  const handleSelect = () => {
    if (onSelect) {
      onSelect();
    }
  };

  return (
    <nav className="app-shell__nav" aria-label="Time Tracker ナビゲーション">
      <NavLink
        to="/time-tracker"
        end
        className={({ isActive }) =>
          ['app-shell__nav-item', isActive ? 'app-shell__nav-item--active' : null]
            .filter(Boolean)
            .join(' ')
        }
        onClick={handleSelect}
      >
        Time Tracker
      </NavLink>
      <NavLink
        to="/settings"
        end
        className={({ isActive }) =>
          ['app-shell__nav-item', isActive ? 'app-shell__nav-item--active' : null]
            .filter(Boolean)
            .join(' ')
        }
        onClick={handleSelect}
      >
        設定
      </NavLink>
      <button type="button" className="app-shell__nav-item" disabled>
        レポート (準備中)
      </button>
    </nav>
  );
};

type AppNavigationProps = {
  variant: 'sidebar' | 'overlay';
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export const AppNavigation: React.FC<AppNavigationProps> = ({
  variant,
  open = false,
  onOpenChange,
}) => {
  useEffect(() => {
    if (variant !== 'overlay' || !open) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [variant, open]);

  if (variant === 'sidebar') {
    const handleSelect = () => {
      if (onOpenChange) {
        onOpenChange(false);
      }
    };
    return <AppNavList onSelect={handleSelect} />;
  }

  if (!open) {
    return null;
  }

  const handleClose = () => {
    if (onOpenChange) {
      onOpenChange(false);
    }
  };

  return (
    <div
      className="app-navigation__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="ナビゲーションメニュー"
    >
      <button
        type="button"
        className="app-navigation__backdrop"
        aria-label="メニューを閉じる"
        onClick={handleClose}
      />
      <div className="app-navigation__panel">
        <div className="app-navigation__panel-header">
          <span className="app-navigation__panel-title">メニュー</span>
          <button
            type="button"
            className="app-navigation__panel-close"
            onClick={handleClose}
            aria-label="メニューを閉じる"
          >
            ✕
          </button>
        </div>
        <div className="app-navigation__panel-content">
          <AppNavList onSelect={handleClose} />
        </div>
        <div className="app-navigation__panel-footer">
          <AuthStatusBar />
        </div>
      </div>
    </div>
  );
};
