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
import type { ChallengeRecord, ChallengeStatus, PenaltyRecord } from '../persistence/records';
import { completionRate, type CompletionRate } from '../domain/analytics/rates';
import { penaltyStats, type PenaltyStats } from '../domain/analytics/penaltyStats';
import { savingForOneMore, urgencyLevel, type Urgency } from '../domain/analytics/nudges';
import { deriveChallenge, toFacts } from './derive';
import { readSettings, type Settings } from './settings';
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

export interface LedgerEntry {
  readonly challengeId: string;
  readonly planDays: number;
  readonly day: DayKey;
  readonly ratePaise: Paise | null;
  readonly penaltyPaise: Paise;
  /** Amount before the latest revision (late data), if it changed. */
  readonly previousPenaltyPaise: Paise | null;
  readonly revision: number;
}

export interface TrendPoint {
  readonly day: DayKey;
  readonly penaltyPaise: Paise;
  readonly outcome: DayOutcome;
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
  readonly settings: Settings;
  /** Milliseconds until today's local midnight. */
  readonly msLeftToday: number;
  readonly urgency: Urgency;
  /** Paise saved by one more solve today (negative while grace covers a zero day); null outside a challenge. */
  readonly savingForOneMorePaise: number | null;
  /** Every day from the first challenge to today, for streaks and the heatmap. */
  readonly history: readonly DayActivity[];
  readonly rates: { readonly week: CompletionRate; readonly month: CompletionRate };
  /** All evaluated challenge days across challenges. */
  readonly penalty: PenaltyStats;
  /** Last evaluated challenge days, oldest first (max 30). */
  readonly penaltyTrend: readonly TrendPoint[];
  /** Persisted ledger: latest revision of every charged or revised day, newest first. */
  readonly ledger: readonly LedgerEntry[];
}

const TREND_DAYS = 30;
const WEEK_DAYS = 7;
const MONTH_DAYS = 30;

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
  let savingForOneMorePaise: number | null = null;
  const list: ChallengeListItem[] = [];
  const evaluated: TrendPoint[] = [];
  for (const c of challenges) {
    const derived = deriveChallenge(c.config, c.startDay, byDay, nowMs);
    derived.closedResults.forEach((r, i) => {
      const day = derived.dayKeys[i];
      if (day !== undefined)
        evaluated.push({ day, penaltyPaise: r.penaltyPaise, outcome: r.outcome });
    });
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
    savingForOneMorePaise = savingForOneMore(
      c.config,
      derived.closedResults.map((r) => r.solved),
      derived.projectedToday.solved,
    );
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

  const settings = await readSettings(db);
  const msLeftToday = startOfDayMs(addDays(today, 1), tz) - nowMs;
  const todayTarget = targetForDay(today, starts);
  const ledger = buildLedger(await db.penaltyRecords.toArray(), challenges);

  return {
    nowMs,
    today,
    hasAnyChallenge: challenges.length > 0,
    current,
    todayTarget,
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
    settings,
    msLeftToday,
    urgency: urgencyLevel(msLeftToday, todayTarget !== null && todayCount.count >= todayTarget),
    savingForOneMorePaise,
    history: activity,
    rates: {
      week: completionRate(activity, today, WEEK_DAYS),
      month: completionRate(activity, today, MONTH_DAYS),
    },
    penalty: penaltyStats(
      evaluated.map((e) => ({
        penaltyPaise: e.penaltyPaise,
        penalized: e.outcome === 'PARTIAL_PENALIZED' || e.outcome === 'ZERO_PENALIZED',
      })),
    ),
    penaltyTrend: evaluated.sort((a, b) => (a.day < b.day ? -1 : 1)).slice(-TREND_DAYS),
    ledger,
  };
}

function buildLedger(
  records: readonly PenaltyRecord[],
  challenges: readonly ChallengeRecord[],
): LedgerEntry[] {
  const plans = new Map(challenges.map((c) => [c.id, c.config.planDays]));
  const byDay = new Map<string, PenaltyRecord[]>();
  for (const r of records) {
    const key = `${r.challengeId}|${r.day}`;
    byDay.set(key, [...(byDay.get(key) ?? []), r]);
  }
  const entries: LedgerEntry[] = [];
  for (const rows of byDay.values()) {
    rows.sort((a, b) => a.revision - b.revision);
    const latest = rows.at(-1);
    if (latest === undefined) continue;
    const previous = rows.length > 1 ? rows.at(-2) : undefined;
    if (latest.penaltyPaise === 0 && previous === undefined) continue;
    entries.push({
      challengeId: latest.challengeId,
      planDays: plans.get(latest.challengeId) ?? 0,
      day: latest.day,
      ratePaise: latest.ratePaise,
      penaltyPaise: latest.penaltyPaise,
      previousPenaltyPaise: previous?.penaltyPaise ?? null,
      revision: latest.revision,
    });
  }
  return entries.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}
