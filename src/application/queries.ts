import {
  addDays,
  dayKeyOf,
  daysBetween,
  DEFAULT_TIME_ZONE,
  startOfDayMs,
  type DayKey,
} from '../domain/calendar';
import { PLAN_RULES, type ChallengeConfig } from '../domain/challenge/config';
import { summarize, type DayOutcome, type DayResult } from '../domain/challenge/evaluate';
import {
  countDay,
  groupByDay,
  verificationOf,
  type EntryStatus,
  type Evidence,
  type Verification,
} from '../domain/completion/counting';
import {
  platformOf,
  suggestDuplicates,
  type Platform,
  type SourceKey,
} from '../domain/identity/identity';
import { paise, sumPaise, type Paise } from '../domain/money';
import {
  computeStreaks,
  targetForDay,
  type DayActivity,
  type StreakStats,
} from '../domain/streak/streak';
import type { DsaDatabase } from '../persistence/db';
import type { ChallengeRecord, ChallengeStatus } from '../persistence/records';
import { deriveChallenge, toFacts } from './derive';
import {
  META_KEYS,
  readHealth,
  readLeetCodeUsername,
  readStats,
  type Health,
  type StatsCache,
} from './integrationState';

export interface TodayEntry {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly platform: Platform;
  readonly evidence: Evidence;
  readonly verification: Verification;
  readonly status: EntryStatus;
  readonly sourceTimestampMs: number;
}

export type DayState = 'closed' | 'today' | 'upcoming';

export interface ChallengeDayView {
  readonly day: DayKey;
  readonly dayIndex: number;
  readonly state: DayState;
  readonly solved: number | null;
  readonly outcome: DayOutcome | null;
  readonly penaltyPaise: Paise | null;
}

export interface CurrentChallengeView {
  readonly id: string;
  readonly config: ChallengeConfig;
  readonly startDay: DayKey;
  readonly endDay: DayKey;
  readonly planDays: number;
  readonly dayNumber: number;
  readonly successDays: number;
  readonly requiredSuccessDays: number;
  readonly graceRemaining: number;
  readonly graceDays: number;
  readonly closedPenaltyPaise: Paise;
  readonly canStillPass: boolean;
  /** Today's result if the day ended now ("potential penalty"). */
  readonly projectedToday: DayResult;
  readonly days: readonly ChallengeDayView[];
}

export interface ChallengeListItem {
  readonly id: string;
  readonly planDays: number;
  readonly dailyTarget: number;
  readonly startDay: DayKey;
  readonly endDay: DayKey;
  /** Derived, so it is right even before the service worker finalizes. */
  readonly status: ChallengeStatus;
  readonly successDays: number;
  readonly requiredSuccessDays: number;
  readonly totalPenaltyPaise: Paise;
}

export interface IntegrationsView {
  readonly leetcode: {
    readonly username: string | null;
    readonly health: Health;
    readonly stats: StatsCache | null;
  };
  readonly tuf: { readonly health: Health };
}

export interface DuplicateSuggestionView {
  readonly a: SourceKey;
  readonly b: SourceKey;
  readonly titleA: string;
  readonly titleB: string;
}

export interface DashboardView {
  readonly nowMs: number;
  readonly today: DayKey;
  readonly hasAnyChallenge: boolean;
  readonly current: CurrentChallengeView | null;
  readonly todayTarget: number | null;
  readonly todaySolved: number;
  readonly todayEntries: readonly TodayEntry[];
  readonly streak: StreakStats;
  /** Newest first. */
  readonly challenges: readonly ChallengeListItem[];
  readonly lifetimePenaltyPaise: Paise;
  readonly integrations: IntegrationsView;
  /** Cross-platform problems with identical titles awaiting a same/different decision. */
  readonly duplicateSuggestions: readonly DuplicateSuggestionView[];
}

function inForce(day: DayKey, challenges: readonly ChallengeRecord[]): ChallengeRecord | null {
  let found: ChallengeRecord | null = null;
  for (const c of challenges)
    if (c.startDay <= day && (found === null || c.startDay >= found.startDay)) found = c;
  return found;
}

/**
 * Read model for every screen. Pure derivation from stored facts at `nowMs`,
 * so it is correct even if the service worker has not run since midnight.
 */
export async function loadDashboard(db: DsaDatabase, nowMs: number): Promise<DashboardView> {
  const tz = DEFAULT_TIME_ZONE;
  const today = dayKeyOf(nowMs, tz);
  const challenges = (await db.challenges.toArray()).sort((a, b) =>
    a.startDay < b.startDay ? -1 : 1,
  );
  const firstDay = challenges[0]?.startDay ?? today;
  const completions = await db.completions
    .where('sourceTimestampMs')
    .aboveOrEqual(startOfDayMs(firstDay < today ? firstDay : today, tz))
    .toArray();
  const byId = new Map(completions.map((c) => [c.id, c]));
  const mappings = await db.mappings.toArray();
  const byDay = groupByDay(toFacts(completions, mappings), tz);
  const titles = new Map<SourceKey, string>();
  for (const c of completions) titles.set(c.sourceKey, c.title);
  const duplicateSuggestions = suggestDuplicates(
    [...titles].map(([sourceKey, title]) => ({ sourceKey, title })),
    mappings,
  ).map((d) => ({ ...d, titleA: titles.get(d.a) ?? d.a, titleB: titles.get(d.b) ?? d.b }));

  let current: CurrentChallengeView | null = null;
  const list: ChallengeListItem[] = [];
  for (const c of challenges) {
    const derived = deriveChallenge(c.config, c.startDay, byDay, nowMs);
    const summary = summarize(c.config, derived.closedResults);
    const rule = PLAN_RULES[c.config.planDays];
    list.push({
      id: c.id,
      planDays: c.config.planDays,
      dailyTarget: c.config.dailyTarget,
      startDay: c.startDay,
      endDay: c.endDay,
      status: summary.outcome === 'IN_PROGRESS' ? 'ACTIVE' : summary.outcome,
      successDays: summary.successDays,
      requiredSuccessDays: rule.requiredSuccessDays,
      totalPenaltyPaise: summary.totalPenaltyPaise,
    });
    if (derived.todayIndex === null || derived.projectedToday === null) continue;
    const todayIndex = derived.todayIndex;
    current = {
      id: c.id,
      config: c.config,
      startDay: c.startDay,
      endDay: c.endDay,
      planDays: c.config.planDays,
      dayNumber: todayIndex + 1,
      successDays: summary.successDays,
      requiredSuccessDays: rule.requiredSuccessDays,
      graceRemaining: summary.graceRemaining,
      graceDays: rule.graceDays,
      closedPenaltyPaise: summary.totalPenaltyPaise,
      canStillPass: summary.canStillPass,
      projectedToday: derived.projectedToday,
      days: derived.dayKeys.map((day, i): ChallengeDayView => {
        const closed = derived.closedResults[i];
        if (closed !== undefined) {
          return {
            day,
            dayIndex: i,
            state: 'closed',
            solved: closed.solved,
            outcome: closed.outcome,
            penaltyPaise: closed.penaltyPaise,
          };
        }
        if (i === todayIndex) {
          return {
            day,
            dayIndex: i,
            state: 'today',
            solved: derived.projectedToday?.solved ?? 0,
            outcome: null,
            penaltyPaise: null,
          };
        }
        return {
          day,
          dayIndex: i,
          state: 'upcoming',
          solved: null,
          outcome: null,
          penaltyPaise: null,
        };
      }),
    };
  }

  const todayConfig = inForce(today, challenges)?.config;
  const todayCount = countDay(byDay.get(today) ?? [], {
    countManual: todayConfig?.countManual ?? true,
  });
  const todayEntries = todayCount.entries.map((e): TodayEntry => {
    const record = byId.get(e.fact.id);
    return {
      id: e.fact.id,
      title: e.fact.title,
      url: record?.url ?? '',
      platform: platformOf(e.fact.sourceKey),
      evidence: e.fact.evidence,
      verification: verificationOf(e.fact.evidence),
      status: e.status,
      sourceTimestampMs: e.fact.sourceTimestampMs,
    };
  });
  todayEntries.sort((a, b) => b.sourceTimestampMs - a.sourceTimestampMs);

  const activity: DayActivity[] = [];
  const starts = challenges.map((c) => ({
    startDay: c.startDay,
    dailyTarget: c.config.dailyTarget,
  }));
  for (let i = 0; i <= daysBetween(firstDay, today); i += 1) {
    const day = addDays(firstDay, i);
    const countManual = inForce(day, challenges)?.config.countManual ?? true;
    activity.push({
      day,
      solved: countDay(byDay.get(day) ?? [], { countManual }).count,
      target: targetForDay(day, starts),
    });
  }

  return {
    nowMs,
    today,
    hasAnyChallenge: challenges.length > 0,
    current,
    todayTarget: targetForDay(today, starts),
    todaySolved: todayCount.count,
    todayEntries,
    streak: computeStreaks(activity, today),
    challenges: list.reverse(),
    lifetimePenaltyPaise: sumPaise(list.map((c) => c.totalPenaltyPaise).concat(paise(0))),
    integrations: {
      leetcode: {
        username: await readLeetCodeUsername(db),
        health: await readHealth(db, META_KEYS.leetcodeHealth),
        stats: await readStats(db),
      },
      tuf: { health: await readHealth(db, META_KEYS.tufHealth) },
    },
    duplicateSuggestions,
  };
}
