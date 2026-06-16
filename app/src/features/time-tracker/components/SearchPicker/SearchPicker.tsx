import type React from 'react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  attachClickAwayAndEsc,
  filterSuggestions,
  onEnterOrMetaEnter,
  onEnterPickFirstElseSubmit,
} from './logic.ts';

type SearchPickerProps = {
  label: string;
  value: string;
  suggestions: string[];
  placeholder?: string;
  /** プロジェクトのように「未設定」を許す場合 true */
  allowClear?: boolean;
  /** 候補ラベルの接頭辞（例: '#'）。タイトルは空 */
  itemPrefix?: string;
  /** モーダル open 直後に focus したいとき */
  autoFocus?: boolean;
  onChange: (value: string) => void;
};

/**
 * 履歴から検索して選べるコンボボックス。
 * 入力は live に value へ反映され、候補はポップオーバーに表示される。
 * Composer のプロジェクトピッカーと同じ挙動（Enter で先頭候補、⌘Enter で入力確定、IME 対応）。
 */
export const SearchPicker: React.FC<SearchPickerProps> = ({
  label,
  value,
  suggestions,
  placeholder,
  allowClear = false,
  itemPrefix = '',
  autoFocus = false,
  onChange,
}) => {
  const reactId = useId();
  const fieldId = `search-picker-${reactId}`;
  const listboxId = `${fieldId}-listbox`;
  const inputRef = useRef<HTMLInputElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  const filtered = useMemo(() => filterSuggestions(suggestions, value), [suggestions, value]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (!isOpen) return;
    return attachClickAwayAndEsc({
      menuEl: () => popoverRef.current,
      triggerEl: () => inputRef.current,
      onTriggerd: () => setIsOpen(false),
    });
  }, [isOpen]);

  const commit = (next: string) => {
    onChange(next);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="time-tracker__search-picker">
      <label htmlFor={fieldId}>{label}</label>
      <div className="time-tracker__search-picker-control">
        <input
          id={fieldId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onClick={() => setIsOpen(true)}
          onKeyDown={onEnterOrMetaEnter({
            onMetaEnter: () => commit(value),
            onEnter: onEnterPickFirstElseSubmit(
              () => filtered,
              (first) => commit(first),
              () => commit(value),
            ),
          })}
        />

        {isOpen ? (
          <div
            id={listboxId}
            ref={popoverRef}
            className="time-tracker__search-picker-popover"
            role="listbox"
            aria-label={`${label}の候補`}
          >
            {filtered.length > 0 ? (
              <ul className="time-tracker__search-picker-list">
                {filtered.map((candidate) => (
                  <li key={candidate}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={candidate === value}
                      className="time-tracker__search-picker-item"
                      onClick={() => commit(candidate)}
                    >
                      {itemPrefix}
                      {candidate}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="time-tracker__search-picker-empty">
                {value.trim() ? `Enter で「${value.trim()}」を使う` : '履歴がありません'}
              </p>
            )}

            {allowClear && value.trim() ? (
              <div className="time-tracker__search-picker-actions">
                <button type="button" onClick={() => commit('')}>
                  未設定にする
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
};
