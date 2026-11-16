import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PopupApp } from '../../src/ui/shell/PopupApp';

describe('PopupApp', () => {
  it('opens the dashboard side panel and closes the popup', async () => {
    const openDashboard = vi.fn().mockResolvedValue(undefined);
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<PopupApp openDashboard={openDashboard} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));

    expect(openDashboard).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('shows a useful error instead of failing silently', async () => {
    const openDashboard = vi.fn().mockRejectedValue(new Error('Side panel unavailable'));
    const close = vi.spyOn(window, 'close').mockImplementation(() => undefined);
    render(<PopupApp openDashboard={openDashboard} />);

    await userEvent.click(screen.getByRole('button', { name: 'Open dashboard' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Side panel unavailable');
    expect(close).not.toHaveBeenCalled();
  });
});
