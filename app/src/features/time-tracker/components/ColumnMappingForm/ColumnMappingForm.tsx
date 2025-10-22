import React, { useState, useEffect } from 'react';

export type ColumnMappingFormProps = {
  currentMapping?: {
    id?: string;
    status?: string;
    title: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: string;
    project?: string;
    notes?: string;
    tags?: string;
    skill?: string;
    intensity?: string;
  };
  onChange: (mapping: {
    id?: string;
    status?: string;
    title: string;
    startedAt: string;
    endedAt: string;
    durationSeconds: string;
    project?: string;
    notes?: string;
    tags?: string;
    skill?: string;
    intensity?: string;
  }) => void;
};

const REQUIRED_FIELDS = [
  { key: 'id', label: 'セッションID' },
  { key: 'status', label: 'ステータス' },
  { key: 'title', label: 'タイトル' },
  { key: 'startedAt', label: '開始時刻' },
  { key: 'endedAt', label: '終了時刻' },
  { key: 'durationSeconds', label: '所要時間（秒）' },
] as const;

const OPTIONAL_FIELDS = [
  { key: 'project', label: 'プロジェクト' },
  { key: 'notes', label: 'メモ' },
  { key: 'tags', label: 'タグ' },
  { key: 'skill', label: 'スキル' },
  { key: 'intensity', label: '集中度' },
] as const;

export const ColumnMappingForm: React.FC<ColumnMappingFormProps> = ({
  currentMapping,
  onChange,
}) => {
  const [mapping, setMapping] = useState<Record<string, string>>({
    id: currentMapping?.id ?? '',
    status: currentMapping?.status ?? '',
    title: currentMapping?.title ?? 'A',
    startedAt: currentMapping?.startedAt ?? 'B',
    endedAt: currentMapping?.endedAt ?? 'C',
    durationSeconds: currentMapping?.durationSeconds ?? 'D',
    project: currentMapping?.project ?? '',
    notes: currentMapping?.notes ?? '',
    tags: currentMapping?.tags ?? '',
    skill: currentMapping?.skill ?? '',
    intensity: currentMapping?.intensity ?? '',
  });

  useEffect(() => {
    if (currentMapping) {
      setMapping({
        id: currentMapping.id ?? '',
        status: currentMapping.status ?? '',
        title: currentMapping.title,
        startedAt: currentMapping.startedAt,
        endedAt: currentMapping.endedAt,
        durationSeconds: currentMapping.durationSeconds,
        project: currentMapping.project ?? '',
        notes: currentMapping.notes ?? '',
        tags: currentMapping.tags ?? '',
        skill: currentMapping.skill ?? '',
        intensity: currentMapping.intensity ?? '',
      });
    }
  }, [currentMapping]);

  const handleChange = (field: string, value: string) => {
    const newMapping = { ...mapping, [field]: value.trim() };
    setMapping(newMapping);

    // 必須フィールドとオプショナルフィールド（値がある場合のみ）を含めて通知
    const result: Record<string, string> = {
      id: newMapping.id ?? '',
      status: newMapping.status ?? '',
      title: newMapping.title,
      startedAt: newMapping.startedAt,
      endedAt: newMapping.endedAt,
      durationSeconds: newMapping.durationSeconds,
    };

    OPTIONAL_FIELDS.forEach(({ key }) => {
      if (newMapping[key]) {
        result[key] = newMapping[key];
      }
    });

    onChange(result as typeof currentMapping & Record<string, string>);
  };

  return (
    <div className="column-mapping-form">
      <h3>カラムマッピング設定</h3>
      <p className="column-mapping-form__description">
        Time Trackerのフィールドをスプレッドシートの列に割り当ててください。
        列名は「A」「B」などの列記号、またはヘッダー行の文字列を指定できます。
      </p>

      <fieldset className="column-mapping-form__section">
        <legend>必須フィールド</legend>
        {REQUIRED_FIELDS.map(({ key, label }) => (
          <div key={key} className="time-tracker__field">
            <label htmlFor={`mapping-${key}`}>{label}</label>
            <input
              id={`mapping-${key}`}
              type="text"
              value={mapping[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="例: A または タイトル"
              required
            />
          </div>
        ))}
      </fieldset>

      <fieldset className="column-mapping-form__section">
        <legend>オプションフィールド</legend>
        {OPTIONAL_FIELDS.map(({ key, label }) => (
          <div key={key} className="time-tracker__field">
            <label htmlFor={`mapping-${key}`}>{label}</label>
            <input
              id={`mapping-${key}`}
              type="text"
              value={mapping[key] ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder="例: E （未設定の場合は同期されません）"
            />
          </div>
        ))}
      </fieldset>
    </div>
  );
};
