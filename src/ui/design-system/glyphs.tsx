/** Shape half of the colour code, so state never depends on colour alone. */
interface GlyphProps {
  className?: string;
}

const base = { viewBox: '0 0 12 12', 'aria-hidden': true, focusable: false } as const;

export const CheckGlyph = ({ className = '' }: GlyphProps) => (
  <svg {...base} className={`size-3 ${className}`}>
    <circle cx="6" cy="6" r="6" fill="currentColor" />
    <path
      d="M3.4 6.2 5.2 8l3.4-3.8"
      fill="none"
      stroke="var(--bg)"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const HalfGlyph = ({ className = '' }: GlyphProps) => (
  <svg {...base} className={`size-3 ${className}`}>
    <circle cx="6" cy="6" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    <path d="M6 0.8a5.2 5.2 0 0 1 0 10.4z" fill="currentColor" />
  </svg>
);

export const RingGlyph = ({ className = '' }: GlyphProps) => (
  <svg {...base} className={`size-3 ${className}`}>
    <circle
      cx="6"
      cy="6"
      r="4.9"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeDasharray="2.2 1.6"
    />
  </svg>
);

export const CrossGlyph = ({ className = '' }: GlyphProps) => (
  <svg {...base} className={`size-3 ${className}`}>
    <circle cx="6" cy="6" r="6" fill="currentColor" />
    <path d="m4 4 4 4m0-4-4 4" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const DotGlyph = ({ className = '' }: GlyphProps) => (
  <svg {...base} className={`size-3 ${className}`}>
    <circle cx="6" cy="6" r="3" fill="currentColor" />
  </svg>
);

export const FlameGlyph = ({ className = '' }: GlyphProps) => (
  <svg viewBox="0 0 16 16" aria-hidden focusable={false} className={`size-4 ${className}`}>
    <path
      d="M8.6 1.2c.3 2-1 3.2-2.1 4.4C5.4 6.8 4.3 8 4.3 9.9 4.3 12.3 6 14.6 8 14.6s3.7-1.8 3.7-4.4c0-1.3-.6-2.4-1.3-3.3-.1 1-.6 1.7-1.3 2 .4-2.5-.1-5.4-.5-7.7Z"
      fill="currentColor"
    />
  </svg>
);
