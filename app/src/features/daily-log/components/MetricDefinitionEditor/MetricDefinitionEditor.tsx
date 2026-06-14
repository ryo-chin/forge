import { type FormEvent, useState } from 'react';
import type {
  MetricDefinition,
  MetricDefinitionInput,
  MetricKind,
  MetricOption,
} from '../../domain/types.ts';

type MetricDefinitionEditorProps = {
  initial?: MetricDefinition | null;
  nextDisplayOrder: number;
  onSave: (input: MetricDefinitionInput) => void;
  onDelete?: (id: string) => void;
  onCancel: () => void;
};

const KIND_OPTIONS: { kind: MetricKind; label: string }[] = [
  { kind: 'boolean', label: 'チェックボックス' },
  { kind: 'number', label: '数値' },
  { kind: 'text', label: 'テキスト' },
  { kind: 'single_select', label: '選択ボックス' },
];

const parseOptionsText = (text: string): MetricOption[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((value) => ({ value, label: value }));

const optionsToText = (options?: MetricOption[] | null): string =>
  (options ?? []).map((option) => option.label).join('\n');

export function MetricDefinitionEditor({
  initial,
  nextDisplayOrder,
  onSave,
  onDelete,
  onCancel,
}: MetricDefinitionEditorProps): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '');
  const [kind, setKind] = useState<MetricKind>(initial?.kind ?? 'boolean');
  const [unit, setUnit] = useState(initial?.unit ?? '');
  const [optionsText, setOptionsText] = useState(optionsToText(initial?.options));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      id: initial?.id,
      name: trimmed,
      kind,
      unit: kind === 'number' && unit.trim() ? unit.trim() : null,
      options: kind === 'single_select' ? parseOptionsText(optionsText) : null,
      targetNumber: initial?.targetNumber ?? null,
      displayOrder: initial?.displayOrder ?? nextDisplayOrder,
      archivedAt: null,
    });
  };

  return (
    <form className="daily-log__editor" onSubmit={handleSubmit}>
      <h2 className="daily-log__editor-title">{initial ? '記録項目を編集' : '記録項目を追加'}</h2>

      <label className="daily-log__field">
        <span className="daily-log__field-label">項目名</span>
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="例: ジムで運動する / 体重 / ひとこと"
          required
        />
      </label>

      <label className="daily-log__field">
        <span className="daily-log__field-label">入力の種類</span>
        <select value={kind} onChange={(event) => setKind(event.target.value as MetricKind)}>
          {KIND_OPTIONS.map((option) => (
            <option key={option.kind} value={option.kind}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {kind === 'number' ? (
        <label className="daily-log__field">
          <span className="daily-log__field-label">単位（任意）</span>
          <input
            type="text"
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
            placeholder="例: kg"
          />
        </label>
      ) : null}

      {kind === 'single_select' ? (
        <label className="daily-log__field">
          <span className="daily-log__field-label">選択肢（1行に1つ）</span>
          <textarea
            className="daily-log__textarea"
            value={optionsText}
            onChange={(event) => setOptionsText(event.target.value)}
            rows={4}
            placeholder={'良い\n普通\n悪い'}
          />
        </label>
      ) : null}

      <div className="daily-log__editor-actions">
        {initial && onDelete ? (
          confirmingDelete ? (
            <span className="daily-log__confirm">
              削除しますか？
              <button
                type="button"
                className="daily-log__button-danger"
                onClick={() => onDelete(initial.id)}
              >
                削除する
              </button>
              <button
                type="button"
                className="daily-log__button-ghost"
                onClick={() => setConfirmingDelete(false)}
              >
                やめる
              </button>
            </span>
          ) : (
            <button
              type="button"
              className="daily-log__button-ghost daily-log__delete-link"
              onClick={() => setConfirmingDelete(true)}
            >
              削除
            </button>
          )
        ) : null}
        <span className="daily-log__editor-spacer" />
        <button type="button" className="daily-log__button-ghost" onClick={onCancel}>
          キャンセル
        </button>
        <button type="submit" className="daily-log__button-primary">
          保存
        </button>
      </div>
    </form>
  );
}
