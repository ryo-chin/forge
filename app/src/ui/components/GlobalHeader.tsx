import type React from 'react';
import type { ReactNode } from 'react';

type GlobalHeaderProps = {
  showMenuButton?: boolean;
  onMenuButtonClick?: () => void;
  isMenuOpen?: boolean;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
};

export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  showMenuButton = false,
  onMenuButtonClick,
  isMenuOpen = false,
  leftSlot,
  rightSlot,
}) => {
  const menuLabel = isMenuOpen ? 'メニューを閉じる' : 'メニューを開く';

  return (
    <header className="global-header">
      <div className="global-header__section">
        {showMenuButton ? (
          <button
            type="button"
            className="global-header__menu-button"
            aria-label={menuLabel}
            aria-expanded={isMenuOpen}
            onClick={onMenuButtonClick}
          >
            ☰
          </button>
        ) : null}
        {leftSlot ? <div className="global-header__slot">{leftSlot}</div> : null}
      </div>
      <div className="global-header__section global-header__section--right">{rightSlot}</div>
    </header>
  );
};
