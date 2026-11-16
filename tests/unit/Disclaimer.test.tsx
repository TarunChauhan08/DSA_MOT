import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Disclaimer, VIRTUAL_PENALTY_DISCLAIMER } from '../../src/ui/design-system/Disclaimer';

describe('Disclaimer', () => {
  it('uses the exact wording required by the PRD', () => {
    expect(VIRTUAL_PENALTY_DISCLAIMER).toBe(
      'Virtual penalty only. No actual money is collected, transferred, owed or donated.',
    );
  });

  it('renders as a note', () => {
    render(<Disclaimer />);
    expect(screen.getByRole('note')).toHaveTextContent(VIRTUAL_PENALTY_DISCLAIMER);
  });
});
