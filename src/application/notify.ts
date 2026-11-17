import { addDays } from '../domain/calendar';
import { planNotifications, type PlannedNotification } from '../domain/notifications/planner';
import type { DsaDatabase } from '../persistence/db';
import { loadDashboard, type DashboardView } from './queries';

const DAY_MS = 86_400_000;
/** Notification log entries older than this are pruned. */
const LOG_RETENTION_MS = 45 * DAY_MS;

/** Notifications due now that have never been sent (planner + notificationLog). */
export async function collectDueNotifications(
  db: DsaDatabase,
  nowMs: number,
): Promise<PlannedNotification[]> {
  const view = await loadDashboard(db, nowMs);
  const yesterdayKey = addDays(view.today, -1);
  const yesterday = view.history.find((d) => d.day === yesterdayKey);
  const yesterdayPenalty = view.penaltyTrend.find((p) => p.day === yesterdayKey)?.penaltyPaise ?? 0;
  const finished = await db.challenges
    .filter(
      (c) => c.status !== 'ACTIVE' && c.completedAtMs !== null && nowMs - c.completedAtMs <= DAY_MS,
    )
    .toArray();

  return planNotifications({
    nowMs,
    timeZone: view.current?.config.timeZone ?? 'Asia/Kolkata',
    settings: view.settings.notifications,
    today: {
      day: view.today,
      solved: view.todaySolved,
      target: view.todayTarget,
      streak: view.streak.current,
    },
    yesterday:
      yesterday?.target == null
        ? null
        : {
            day: yesterday.day,
            solved: yesterday.solved,
            target: yesterday.target,
            penaltyPaise: yesterdayPenalty,
          },
    recentlyCompletedChallenges: finished.flatMap((c) => {
      const item = view.challenges.find((x) => x.id === c.id);
      if (item === undefined || c.status === 'ACTIVE') return [];
      return [
        {
          id: c.id,
          status: c.status,
          planDays: c.config.planDays,
          successDays: item.successDays,
          totalPenaltyPaise: item.totalPenaltyPaise,
        },
      ];
    }),
    sentKeys: new Set((await db.notificationLog.toArray()).map((r) => r.eventKey)),
  });
}

export async function markNotificationSent(
  db: DsaDatabase,
  key: string,
  nowMs: number,
): Promise<void> {
  await db.transaction('rw', db.notificationLog, async () => {
    await db.notificationLog.put({ eventKey: key, sentAtMs: nowMs });
    await db.notificationLog
      .where('sentAtMs')
      .below(nowMs - LOG_RETENTION_MS)
      .delete();
  });
}

/** Toolbar badge colours carry the same meaning as the UI (docs/DESIGN.md). */
export const BADGE_COLORS = {
  done: '#059669',
  calm: '#475569',
  'heads-up': '#d97706',
  urgent: '#dc2626',
} as const;

export interface Badge {
  readonly text: string;
  readonly color: string;
}

/** Remaining problems today, coloured by urgency; ✓ when the target is met. */
export function badgeFor(view: DashboardView): Badge {
  if (view.todayTarget === null) return { text: '', color: BADGE_COLORS.calm };
  const remaining = view.todayTarget - view.todaySolved;
  if (remaining <= 0) return { text: '✓', color: BADGE_COLORS.done };
  return {
    text: String(remaining),
    color: BADGE_COLORS[view.urgency === 'done' ? 'calm' : view.urgency],
  };
}
