import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VIRTUAL_PENALTY_DISCLAIMER } from '../../src/ui/design-system/Disclaimer';
import { DashboardApp } from '../../src/ui/shell/DashboardApp';

function navigate(hash: string) {
  act(() => {
    window.location.hash = hash;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}

describe('DashboardApp', () => {
  it('starts on the initial route and shows onboarding on first run', async () => {
    render(<DashboardApp initialRoute="today" />);
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('Make skipping DSA expensive.')).toBeInTheDocument();
  });

  it('switches views on hash change', async () => {
    render(<DashboardApp initialRoute="today" />);
    navigate('#/history');
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
    expect(await screen.findByText('No history yet')).toBeInTheDocument();
  });

  it('opens on settings when used as the options page', () => {
    render(<DashboardApp initialRoute="settings" />);
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });

  it('always shows the virtual penalty disclaimer', () => {
    render(<DashboardApp initialRoute="today" />);
    expect(screen.getByRole('note')).toHaveTextContent(VIRTUAL_PENALTY_DISCLAIMER);
  });

  it('shows no numeric metrics while there is no data', async () => {
    const { container } = render(<DashboardApp initialRoute="today" />);
    await screen.findByText('Make skipping DSA expensive.');
    expect(container.querySelector('main')?.textContent).not.toMatch(/₹|\d+\s*\/\s*\d+/);
  });
});
