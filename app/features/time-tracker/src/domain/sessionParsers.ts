import type { SessionDraft, TimeTrackerSession } from '../types';

const INTENSITY_VALUES = new Set<SessionDraft['intensity']>([
  'low',
  'medium',
  'high',
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const parseOptionalString = (value: unknown) =>
  typeof value === 'string' && value.trim().length > 0 ? value : undefined;

export const parseTagsArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const tags = value
    .filter((item): item is string => typeof item === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length ? tags : undefined;
};

export const parseIntensity = (value: unknown) =>
  typeof value === 'string' && INTENSITY_VALUES.has(value as SessionDraft['intensity'])
    ? (value as SessionDraft['intensity'])
    : undefined;

export const parseSession = (value: unknown): TimeTrackerSession | null => {
  if (!isRecord(value)) return null;
  const { id, title, startedAt, endedAt, durationSeconds } = value;
  if (typeof id !== 'string' || typeof title !== 'string') return null;
  if (
    typeof startedAt !== 'number' ||
    Number.isNaN(startedAt) ||
    typeof endedAt !== 'number' ||
    Number.isNaN(endedAt) ||
    typeof durationSeconds !== 'number' ||
    Number.isNaN(durationSeconds)
  ) {
    return null;
  }

  const session: TimeTrackerSession = {
    id,
    title,
    startedAt,
    endedAt,
    durationSeconds,
  };

  const tags = parseTagsArray(value.tags);
  if (tags) session.tags = tags;
  const project = parseOptionalString(value.project);
  if (project) session.project = project;
  const skill = parseOptionalString(value.skill);
  if (skill) session.skill = skill;
  const notes = parseOptionalString(value.notes);
  if (notes) session.notes = notes;
  const intensity = parseIntensity(value.intensity);
  if (intensity) session.intensity = intensity;

  return session;
};

export const parseRunningDraft = (value: unknown): SessionDraft | null => {
  if (!isRecord(value)) return null;
  const { title, startedAt } = value;
  if (typeof title !== 'string') return null;
  if (typeof startedAt !== 'number' || Number.isNaN(startedAt)) return null;

  return {
    title,
    startedAt,
    tags: parseTagsArray(value.tags),
    project: parseOptionalString(value.project),
    skill: parseOptionalString(value.skill),
    notes: parseOptionalString(value.notes),
    intensity: parseIntensity(value.intensity),
  };
};
