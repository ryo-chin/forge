export const formatTimer = (seconds: number) => {
  const mm = Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0');
  const ss = Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0');
  return `${mm}:${ss}`;
};

export const formatDurationForAria = (seconds: number) => {
  if (seconds <= 0) return '0秒';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}時間`);
  if (minutes > 0) parts.push(`${minutes}分`);
  if (parts.length === 0 || remainingSeconds > 0) {
    parts.push(`${remainingSeconds}秒`);
  }
  return parts.join('');
};

export const createNudgeLabel = (deltaMinutes: number) =>
  deltaMinutes > 0
    ? `経過時間を${deltaMinutes}分延長`
    : `経過時間を${Math.abs(deltaMinutes)}分短縮`;
