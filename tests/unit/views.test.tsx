import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDashboard } from '../../src/application/queries';
import { recordCompletion, startChallenge } from '../../src/application/useCases';
import { ChallengeView } from '../../src/ui/views/ChallengeView';
import { HistoryView } from '../../src/ui/views/HistoryView';
import { SetupView } from '../../src/ui/views/SetupView';
import { TodayView } from '../../src/ui/views/TodayView';
import { config, makeDeps } from '../integration/helpers';
import type * as MessagingClient from '../../src/messaging/client';

const sendCommand = vi.hoisted(() => vi.fn());
vi.mock('../../src/messaging/client', async (importOriginal) => ({
  ...(await importOriginal<typeof MessagingClient>()),
  sendCommand,
}));

beforeEach(() => {
  sendCommand.mockReset();
  sendCommand.mockResolvedValue({ ok: true });
});

async function viewWith(solvedToday: number, startOverrides = {}) {
  const deps = makeDeps('2026-11-16T09:00');
  await startChallenge(deps, config(startOverrides));
  for (let i = 0; i < solvedToday; i += 1) {
    await recordCompletion(deps, {
      evidence: 'USER_MANUAL',
      platform: 'leetcode',
      slug: `p${String(i)}`,
      title: `Problem ${String(i)}`,
    });
  }
  return loadDashboard(deps.db, deps.clock.now());
}

describe('TodayView', () => {
  it('shows progress, challenge stats and the potential penalty', async () => {
    render(<TodayView view={await viewWith(2)} />);
    expect(screen.getByRole('img', { name: '2 of 4 problems solved today' })).toBeInTheDocument();
    expect(screen.getByText('2 more to go.')).toBeInTheDocument();
    expect(screen.getByText('₹10 at stake. Each problem now saves ₹5.')).toBeInTheDocument();
    expect(screen.getByText('Day 1 of 7')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: '2 of 2 grace days left' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Challenge days' }).children).toHaveLength(7);
    expect(screen.getAllByText('Manual')).toHaveLength(2);
  });

  it('explains grace when nothing is solved yet', async () => {
    render(<TodayView view={await viewWith(0)} />);
    expect(
      screen.getByText('Ending at zero uses 1 of your 2 grace days. Hit all 4 to keep it.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Nothing logged yet\./)).toBeInTheDocument();
  });

  it('confirms when the target is met', async () => {
    render(<TodayView view={await viewWith(4)} />);
    expect(screen.getByText('Done for today.')).toBeInTheDocument();
    expect(screen.getByText('No virtual penalty today. See you tomorrow.')).toBeInTheDocument();
    expect(screen.getByText('Streak safe', { exact: true })).toBeInTheDocument(); // countdown chip
  });

  it('adds a manual problem from a pasted LeetCode link', async () => {
    render(<TodayView view={await viewWith(0)} />);
    await userEvent.type(screen.getByRole('textbox'), 'https://leetcode.com/problems/two-sum/');
    await userEvent.click(screen.getByRole('button', { name: 'Add problem' }));
    expect(sendCommand).toHaveBeenCalledWith({
      type: 'ADD_MANUAL_PROBLEM',
      platform: 'leetcode',
      slug: 'two-sum',
      title: 'Two Sum',
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Added “Two Sum”');
  });

  it('shows a clear error for unsupported links without sending anything', async () => {
    render(<TodayView view={await viewWith(0)} />);
    await userEvent.type(
      screen.getByRole('textbox'),
      'https://codeforces.com/problemset/problem/1/A',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Add problem' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Only LeetCode and takeUforward links are supported.',
    );
    expect(sendCommand).not.toHaveBeenCalled();
  });
});

describe('SetupView', () => {
  it('reviews the summary, then starts the challenge only after confirmation', async () => {
    const empty = await loadDashboard(makeDeps().db, Date.parse('2026-11-16T03:30:00Z'));
    render(<SetupView view={empty} />);
    await userEvent.click(screen.getByRole('radio', { name: /15 days/ }));
    const target = screen.getByLabelText('Daily target');
    await userEvent.clear(target);
    await userEvent.type(target, '5');
    expect(screen.getByText(/Solve at least/)).toHaveTextContent(
      'Solve at least 5 problems every day for 15 days. You need 12 full days to pass. Up to 3 empty days',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Review challenge' }));
    expect(sendCommand).not.toHaveBeenCalled();
    expect(
      screen.getByText('Once started, these settings are locked and the challenge cannot be quit.'),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Start challenge' }));
    expect(sendCommand).toHaveBeenCalledWith({
      type: 'START_CHALLENGE',
      input: {
        planDays: 15,
        dailyTarget: 5,
        startPenaltyRupees: 20,
        incrementRupees: 20,
        countManual: true,
      },
    });
  });

  it('blocks review while a field is invalid', async () => {
    const empty = await loadDashboard(makeDeps().db, Date.parse('2026-11-16T03:30:00Z'));
    render(<SetupView view={empty} />);
    await userEvent.clear(screen.getByLabelText('Daily target'));
    expect(screen.getByRole('button', { name: 'Review challenge' })).toBeDisabled();
    expect(screen.getByText('Fix the highlighted fields to continue.')).toBeInTheDocument();
  });

  it('refuses to set up a second challenge while one is running', async () => {
    render(<SetupView view={await viewWith(0)} />);
    expect(screen.getByText('A challenge is already running')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Review challenge' })).not.toBeInTheDocument();
  });

  it('shows the service worker refusal to the user', async () => {
    sendCommand.mockResolvedValue({ ok: false, error: 'ACTIVE_CHALLENGE_EXISTS' });
    const empty = await loadDashboard(makeDeps().db, Date.parse('2026-11-16T03:30:00Z'));
    render(<SetupView view={empty} />);
    await userEvent.click(screen.getByRole('button', { name: 'Review challenge' }));
    await userEvent.click(screen.getByRole('button', { name: 'Start challenge' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have an active challenge',
    );
  });
});

describe('ChallengeView and HistoryView', () => {
  it('lists every plan day with the locked config and no edit controls', async () => {
    render(<ChallengeView view={await viewWith(1)} />);
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(8); // header + 7 days
    expect(screen.getByText('₹15*')).toBeInTheDocument(); // 1/4 on first penalized day
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('summarizes challenges in history', async () => {
    render(<HistoryView view={await viewWith(1)} />);
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('7-day, 4/day')).toBeInTheDocument();
  });
});

describe('SettingsView', () => {
  it('keeps unsaved edits when unrelated data refreshes, and saves the full settings', async () => {
    const { SettingsView } = await import('../../src/ui/views/SettingsView');
    const view = await viewWith(0);
    const { rerender } = render(<SettingsView view={view} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Light' }));
    rerender(<SettingsView view={{ ...view, todaySolved: 1, settings: { ...view.settings } }} />);
    expect(screen.getByRole('radio', { name: 'Light' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('switch', { name: /Morning summary/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save settings' }));
    expect(sendCommand).toHaveBeenCalledWith({
      type: 'UPDATE_SETTINGS',
      settings: {
        theme: 'light',
        countManualDefault: true,
        notifications: {
          enabled: true,
          reminderTime: '20:00',
          deadlineMinutesBefore: 60,
          targetMet: true,
          dailySummary: true,
        },
      },
    });
    expect(await screen.findByRole('status')).toHaveTextContent('Settings saved.');
  });
});
