// デイリーカスタム記録ドメインの型定義（副作用なし）

/**
 * 記録項目の種別。
 * - boolean: チェックボックス（チェック=記録あり）
 * - number: 数値入力
 * - text: テキスト入力（自由記述）
 * - single_select: 選択ボックス（単一）
 * - multi_select: 複数選択（スキーマ・型の土台。UI は将来）
 */
export type MetricKind = 'boolean' | 'number' | 'text' | 'single_select' | 'multi_select';

/** 選択式の選択肢（将来用） */
export type MetricOption = {
  value: string;
  label: string;
};

/** 記録項目の定義 */
export type MetricDefinition = {
  id: string;
  name: string;
  kind: MetricKind;
  unit?: string | null; // 例: 'kg'
  options?: MetricOption[] | null; // 選択式用（将来）
  targetNumber?: number | null; // 数値項目の目標値（将来の予実化フック）
  displayOrder: number;
  archivedAt?: string | null;
};

export type MetricDefinitionInput = Omit<MetricDefinition, 'id'> & { id?: string };

/**
 * 記録値。kind に応じて型が変わる：
 * - boolean: true/false
 * - number: 数値
 * - single_select: 選択肢の value（string）
 * - multi_select: value の配列（string[]）
 */
export type MetricValue = boolean | number | string | string[];

/** ある日のある項目の記録 */
export type MetricEntry = {
  id: string;
  metricId: string;
  entryDate: string; // 'YYYY-MM-DD'
  value: MetricValue;
};

export type MetricEntryInput = Omit<MetricEntry, 'id'> & { id?: string };
