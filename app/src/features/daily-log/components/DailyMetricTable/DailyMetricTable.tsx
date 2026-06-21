import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useState } from 'react';
import type { MetricDefinition, MetricEntry, MetricValue } from '../../domain/types.ts';

type DailyMetricTableProps = {
  definitions: MetricDefinition[];
  days: string[]; // 表示する日付キー（新しい順）
  todayKey: string;
  entryFor: (metricId: string, dateKey: string) => MetricEntry | undefined;
  onCommit: (metricId: string, dateKey: string, value: MetricValue | null) => void;
  onEditDefinition: (definition: MetricDefinition) => void;
  /** 列ヘッダのドラッグで並び替えた新しい項目順（id 配列）を通知する。未指定なら並び替え無効。 */
  onReorder?: (orderedIds: string[]) => void;
};

const formatDayLabel = (dateKey: string): string => {
  const [, month, day] = dateKey.split('-');
  const weekday = ['日', '月', '火', '水', '木', '金', '土'][
    new Date(`${dateKey}T00:00:00`).getDay()
  ];
  return `${Number(month)}/${Number(day)}(${weekday})`;
};

/** 数値・テキストの入力セル（編集中はローカル下書き、確定は blur / Enter）。 */
function EditableCell({
  kind,
  value,
  onCommit,
}: {
  kind: 'number' | 'text';
  value: MetricValue | undefined;
  onCommit: (value: MetricValue | null) => void;
}): JSX.Element {
  const initial = value == null ? '' : String(value);
  const [draft, setDraft] = useState(initial);

  useEffect(() => {
    setDraft(value == null ? '' : String(value));
  }, [value]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed === '') {
      onCommit(null);
      return;
    }
    if (kind === 'number') {
      const parsed = Number.parseFloat(trimmed);
      onCommit(Number.isFinite(parsed) ? parsed : null);
      return;
    }
    onCommit(trimmed);
  };

  return (
    <input
      className={`daily-log__cell-input ${kind === 'number' ? 'daily-log__cell-input--number' : ''}`}
      type={kind === 'number' ? 'number' : 'text'}
      inputMode={kind === 'number' ? 'decimal' : undefined}
      step={kind === 'number' ? 'any' : undefined}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      placeholder="—"
    />
  );
}

/** 並び替え可能な列ヘッダ。ドラッグはハンドルのみ、項目名クリックは従来どおり編集。 */
function SortableHeaderCell({
  definition,
  sortable,
  onEditDefinition,
}: {
  definition: MetricDefinition;
  sortable: boolean;
  onEditDefinition: (definition: MetricDefinition) => void;
}): JSX.Element {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: definition.id,
    disabled: !sortable,
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
  };

  return (
    <th ref={setNodeRef} style={style} className={isDragging ? 'daily-log__th--dragging' : ''}>
      <div className="daily-log__col-head-wrap">
        {sortable ? (
          <button
            type="button"
            className="daily-log__col-drag"
            aria-label={`${definition.name} の並び替え`}
            title="ドラッグで並び替え"
            {...attributes}
            {...listeners}
          >
            ⋮⋮
          </button>
        ) : null}
        <button
          type="button"
          className="daily-log__col-head"
          onClick={() => onEditDefinition(definition)}
          title="項目を編集"
        >
          {definition.name}
          {definition.unit ? (
            <span className="daily-log__col-unit">（{definition.unit}）</span>
          ) : null}
        </button>
      </div>
    </th>
  );
}

export function DailyMetricTable({
  definitions,
  days,
  todayKey,
  entryFor,
  onCommit,
  onEditDefinition,
  onReorder,
}: DailyMetricTableProps): JSX.Element {
  const sortable = Boolean(onReorder) && definitions.length > 1;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = definitions.map((definition) => definition.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from === -1 || to === -1) return;
    onReorder?.(arrayMove(ids, from, to));
  };

  const headerRow = (
    <tr>
      <th className="daily-log__th-date">日付</th>
      {definitions.map((definition) => (
        <SortableHeaderCell
          key={definition.id}
          definition={definition}
          sortable={sortable}
          onEditDefinition={onEditDefinition}
        />
      ))}
    </tr>
  );

  const body = (
    <tbody>
      {days.map((dateKey) => (
        <tr key={dateKey} className={dateKey === todayKey ? 'daily-log__row--today' : ''}>
          <th className="daily-log__td-date" scope="row">
            {formatDayLabel(dateKey)}
          </th>
          {definitions.map((definition) => {
            const entry = entryFor(definition.id, dateKey);
            const value = entry?.value;
            return (
              <td key={definition.id} className="daily-log__cell">
                {definition.kind === 'boolean' ? (
                  <input
                    type="checkbox"
                    className="daily-log__cell-check"
                    checked={value === true}
                    onChange={(event) =>
                      onCommit(definition.id, dateKey, event.target.checked ? true : null)
                    }
                    aria-label={`${definition.name} ${formatDayLabel(dateKey)}`}
                  />
                ) : definition.kind === 'single_select' ? (
                  <select
                    className="daily-log__cell-select"
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) =>
                      onCommit(definition.id, dateKey, event.target.value || null)
                    }
                    aria-label={`${definition.name} ${formatDayLabel(dateKey)}`}
                  >
                    <option value="">—</option>
                    {(definition.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : definition.kind === 'number' || definition.kind === 'text' ? (
                  <EditableCell
                    kind={definition.kind}
                    value={value}
                    onCommit={(next) => onCommit(definition.id, dateKey, next)}
                  />
                ) : (
                  <span className="daily-log__unsupported">準備中</span>
                )}
              </td>
            );
          })}
        </tr>
      ))}
    </tbody>
  );

  return (
    <div className="daily-log__table-wrap">
      <table className="daily-log__table">
        {sortable ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={definitions.map((definition) => definition.id)}
              strategy={horizontalListSortingStrategy}
            >
              <thead>{headerRow}</thead>
            </SortableContext>
          </DndContext>
        ) : (
          <thead>{headerRow}</thead>
        )}
        {body}
      </table>
    </div>
  );
}
