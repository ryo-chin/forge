// 予実表示用の整形（分 → 時間）。副作用なし。

export const minutesToHours = (minutes: number): number => minutes / 60;

/** 例: 90 -> "1.5h" */
export const formatHours = (minutes: number): string => `${(minutes / 60).toFixed(1)}h`;

/** 予実差用。符号付き。例: +138 -> "+2.3h" / -90 -> "-1.5h" */
export const formatHoursSigned = (minutes: number): string => {
  const hours = minutes / 60;
  const sign = hours >= 0 ? '+' : '';
  return `${sign}${hours.toFixed(1)}h`;
};
