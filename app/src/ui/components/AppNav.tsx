import React, { useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { AuthStatusBar } from '@features/logiin';

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
          [
            'app-shell__nav-item',
            isActive ? 'app-shell__nav-item--active' : null,
          ]
            .filter(Boolean)
            .join(' ')
        }
        onClick={handleSelect}
      >
        Time Tracker
      </NavLink>
      <button type="button" className="app-shell__nav-item" disabled>
        レポート (準備中)
      </button>
    </nav>
  );
};

export const AppNav: React.FC<NavListProps> = ({ onSelect }) => (
  <AppNavList onSelect={onSelect} />
);

type AppNavOverlayProps = {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: () => void;
};

export const AppNavOverlay: React.FC<AppNavOverlayProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleNavigate = () => {
    if (onSelect) {
      onSelect();
    }
    onClose();
  };

  return (
    <div
      className="time-tracker__nav-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="ナビゲーションメニュー"
    >
      <button
        type="button"
        className="time-tracker__nav-backdrop"
        aria-label="メニューを閉じる"
        onClick={onClose}
      />
      <div className="time-tracker__nav-panel">
        <div className="time-tracker__nav-panel-header">
          <span className="time-tracker__nav-title">メニュー</span>
          <button
            type="button"
            className="time-tracker__nav-close time-tracker__touch-target"
            onClick={onClose}
            aria-label="メニューを閉じる"
          >
            ✕
          </button>
        </div>
        <div className="time-tracker__nav-scroll">
          <AppNavList onSelect={handleNavigate} />
        </div>
        <div className="time-tracker__nav-footer">
          <AuthStatusBar />
        </div>
      </div>
    </div>
  );
};
