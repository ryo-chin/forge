// 予実管理ドメインの型定義（副作用なし）

/** 集計の単位 */
export type PeriodUnit = 'day' | 'week' | 'month';

/**
 * タグ単位の予算定義。
 * weekdayMinutes は長さ7・index 0=日曜（JS Date.getDay() 準拠）の
 * 1日あたり予算「分」。effectiveTo が null の場合は継続中。
 */
export type Budget = {
  id: string;
  tag: string;
  label?: string | null;
  weekdayMinutes: number[];
  effectiveFrom: string; // 'YYYY-MM-DD'
  effectiveTo?: string | null; // 'YYYY-MM-DD' | null
};

/** 予算の新規作成・更新用入力（id は未確定なら省略） */
export type BudgetInput = Omit<Budget, 'id'> & { id?: string };

/**
 * 期間（日次/週次/月次）ごとの予実1行。
 * スプレッドシートの「期間別 予算/実績/差」＋「累積 予算/実績/差」に対応。
 * 数値はすべて「分」。表示側で時間に変換する。
 */
export type BudgetActualRow = {
  /** バケット開始日のキー 'YYYY-MM-DD'（チャートの x 軸に使う） */
  date: string;
  /** 表示用ラベル（'M/D' / 'M/D週' / 'YYYY/MM'） */
  label: string;
  budgetMinutes: number;
  actualMinutes: number;
  varianceMinutes: number;
  cumulativeBudgetMinutes: number;
  cumulativeActualMinutes: number;
  cumulativeVarianceMinutes: number;
};
