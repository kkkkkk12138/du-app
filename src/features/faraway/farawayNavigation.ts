export const FARAWAY_VIEWS = [
  ['places', '足迹'],
  ['wishes', '念想'],
  ['quests', '副本'],
] as const;

export type FarawayView = (typeof FARAWAY_VIEWS)[number][0];
