export const formatDateTimeLocal = (timestamp: number) => {
  const date = new Date(timestamp);
  const tzOffsetMinutes = date.getTimezoneOffset();
  const local = new Date(timestamp - tzOffsetMinutes * 60_000);
  return local.toISOString().slice(0, 16);
};

export const parseDateTimeLocal = (value: string): number | null => {
  if (!value) return null;
  const parsed = new Date(value);
  const time = parsed.getTime();
  return Number.isNaN(time) ? null : time;
};

// =====================================================================
// 日付キー（'YYYY-MM-DD' ローカル日）ユーティリティ
// 予実集計・デイリー記録で日単位のバケットに使う純粋関数群。
// 文字列 'YYYY-MM-DD' は辞書順 = 日付順なので比較・ソートにそのまま使える。
// =====================================================================

/** タイムスタンプ / Date をローカルタイムゾーンの 'YYYY-MM-DD' に変換する。 */
export const toDateKey = (input: number | Date): string => {
  const date = typeof input === 'number' ? new Date(input) : input;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** 'YYYY-MM-DD' をローカル日の Date（00:00 ローカル）に変換する。 */
export const dateKeyToDate = (key: string): Date => {
  const [year, month, day] = key.split('-').map((part) => Number(part));
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
};

/** 日付キーに days 日加算した日付キーを返す（負数も可）。 */
export const addDays = (key: string, days: number): string => {
  const date = dateKeyToDate(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};

/** fromKey〜toKey（両端含む）の日付キーを昇順で列挙する。 */
export const eachDayKey = (fromKey: string, toKey: string): string[] => {
  const result: string[] = [];
  if (fromKey > toKey) return result;
  let current = fromKey;
  // 無限ループ保護（約270年分）
  for (let guard = 0; current <= toKey && guard < 100_000; guard += 1) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
};

/** 曜日インデックス（0=日曜, JS Date.getDay() 準拠）。 */
export const weekdayIndex = (key: string): number => dateKeyToDate(key).getDay();

/** その日が属する週の開始日キー。weekStartsOn は 0=日曜 / 1=月曜（既定）。 */
export const weekStartKey = (key: string, weekStartsOn = 1): string => {
  const diff = (weekdayIndex(key) - weekStartsOn + 7) % 7;
  return addDays(key, -diff);
};

/** その日が属する月の初日キー（'YYYY-MM-01'）。 */
export const monthStartKey = (key: string): string => `${key.slice(0, 7)}-01`;

/** 日付キーに months か月加算（月末は自動繰り上がり）。 */
export const addMonths = (key: string, months: number): string => {
  const date = dateKeyToDate(key);
  date.setMonth(date.getMonth() + months);
  return toDateKey(date);
};

/** 2つの日付キーの差（日数, fromKey 基準で toKey までの日数）。 */
export const diffDays = (fromKey: string, toKey: string): number => {
  const from = dateKeyToDate(fromKey).getTime();
  const to = dateKeyToDate(toKey).getTime();
  return Math.round((to - from) / 86_400_000);
};
