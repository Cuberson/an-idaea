import type { DeadlineItem, IdeaRecord } from '../types/idea';

export type DeadlineTone = 'done' | 'overdue' | 'soon' | 'upcoming';

export function sortDeadlines(deadlines: DeadlineItem[]): DeadlineItem[] {
  return [...deadlines].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.dueDate.localeCompare(b.dueDate);
  });
}

export function getDeadlineStatus(
  dueDate: string,
  done: boolean,
  referenceDate = new Date(),
): { label: string; tone: DeadlineTone } {
  if (done) {
    return { label: 'Done', tone: 'done' };
  }
  const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return { label: dueDate, tone: 'upcoming' };
  }

  const targetUtc = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  const todayUtc = Date.UTC(
    referenceDate.getUTCFullYear(),
    referenceDate.getUTCMonth(),
    referenceDate.getUTCDate(),
  );
  const diffDays = Math.round((targetUtc - todayUtc) / 86_400_000);

  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d overdue`,
      tone: 'overdue',
    };
  }
  if (diffDays === 0) {
    return { label: 'Today', tone: 'soon' };
  }
  if (diffDays <= 5) {
    return { label: `${diffDays}d left`, tone: 'soon' };
  }
  return { label: `${diffDays}d left`, tone: 'upcoming' };
}

export function formatShortDate(dueDate: string): string {
  const match = dueDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return dueDate;
  const dt = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function resolveDocumentContent(
  idea: Pick<IdeaRecord, 'documentContent' | 'summary' | 'architectureNotes'>,
): string {
  if (idea.documentContent && idea.documentContent.trim().length > 0) {
    return idea.documentContent;
  }
  return [idea.summary, idea.architectureNotes]
    .map((s) => s?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');
}
