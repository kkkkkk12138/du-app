import {
  FARAWAY_VIEWS,
  FarawayView,
} from '../src/features/faraway/farawayNavigation';

test('keeps Faraway focused on places, wishes, and quests only', () => {
  const ids: FarawayView[] = FARAWAY_VIEWS.map(([id]) => id);
  const labels = FARAWAY_VIEWS.map(([, label]) => label);

  expect(ids).toEqual(['places', 'wishes', 'quests']);
  expect(labels).toEqual(['足迹', '念想', '副本']);
  expect(labels).not.toContain('主线');
});
