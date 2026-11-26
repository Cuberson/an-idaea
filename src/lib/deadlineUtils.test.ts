import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatShortDate,
  getDeadlineStatus,
  resolveDocumentContent,
  sortDeadlines,
} from './deadlineUtils';

test('getDeadlineStatus computes overdue, today, soon, upcoming, and done states', () => {
  const ref = new Date('2026-11-25T12:00:00Z');
  assert.deepEqual(getDeadlineStatus('2026-11-25', true, ref), {
    label: 'Done',
    tone: 'done',
  });
  assert.deepEqual(getDeadlineStatus('2026-11-23', false, ref), {
    label: '2d overdue',
    tone: 'overdue',
  });
  assert.deepEqual(getDeadlineStatus('2026-11-25', false, ref), {
    label: 'Today',
    tone: 'soon',
  });
  assert.deepEqual(getDeadlineStatus('2026-11-28', false, ref), {
    label: '3d left',
    tone: 'soon',
  });
  assert.deepEqual(getDeadlineStatus('2026-12-10', false, ref), {
    label: '15d left',
    tone: 'upcoming',
  });
});

test('sortDeadlines places incomplete earliest deadlines first', () => {
  const sorted = sortDeadlines([
    { id: '1', label: 'Done item', dueDate: '2026-11-20', done: true },
    { id: '2', label: 'Later', dueDate: '2026-12-15', done: false },
    { id: '3', label: 'Sooner', dueDate: '2026-11-30', done: false },
  ]);
  assert.deepEqual(
    sorted.map((d) => d.id),
    ['3', '2', '1'],
  );
});

test('formatShortDate formats ISO date to clean short month/day', () => {
  assert.equal(formatShortDate('2026-12-04'), 'Dec 4');
});

test('resolveDocumentContent falls back cleanly to summary + architectureNotes', () => {
  assert.equal(
    resolveDocumentContent({
      documentContent: 'Full prose draft',
      summary: 'Old',
      architectureNotes: 'Notes',
    }),
    'Full prose draft',
  );
  assert.equal(
    resolveDocumentContent({
      documentContent: '',
      summary: 'Core summary',
      architectureNotes: 'Step 1',
    }),
    'Core summary\n\nStep 1',
  );
});
