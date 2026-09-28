import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 22, rest: SVGProps<SVGSVGElement> = {}) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...rest,
});

export const I = {
  Studio: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><rect x="3.5" y="3.5" width="7" height="7" rx="2" /><rect x="13.5" y="3.5" width="7" height="7" rx="2" /><rect x="3.5" y="13.5" width="7" height="7" rx="2" /><path d="M17 13.5v7M13.5 17h7" /></svg>
  ),
  Enhance: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></svg>
  ),
  Photos: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c1-3.6 4-5.5 7.5-5.5s6.5 1.9 7.5 5.5" /></svg>
  ),
  Filters: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="9" cy="10" r="5.5" /><circle cx="15" cy="10" r="5.5" /><circle cx="12" cy="15" r="5.5" /></svg>
  ),
  Videos: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><rect x="3" y="5" width="18" height="14" rx="3.5" /><path d="M10.5 9.5v5l4-2.5z" fill="currentColor" /></svg>
  ),
  Retouch: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M14.5 4.5l5 5L9 20H4v-5z" /><path d="M12.5 6.5l5 5" /></svg>
  ),
  Gear: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" /></svg>
  ),
  Back: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M15 5l-7 7 7 7" /></svg>,
  Chevron: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M9 5l7 7-7 7" /></svg>,
  Down: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M6 9l6 6 6-6" /></svg>,
  Close: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M6 6l12 12M18 6L6 18" /></svg>,
  Plus: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M12 5v14M5 12h14" /></svg>,
  Check: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>,
  Share: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M5 12v6.5A2.5 2.5 0 007.5 21h9a2.5 2.5 0 002.5-2.5V12" /></svg>
  ),
  Download: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" /><path d="M5 19h14" /></svg>
  ),
  Link: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1" /><path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1" /></svg>
  ),
  Lock: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><rect x="5" y="10.5" width="14" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 018 0v2.5" /></svg>
  ),
  Shield: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" /><path d="M9 12l2 2 4-4" /></svg>
  ),
  Bolt: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></svg>,
  Wand: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M4 20L15 9M13 7l2-2 4 4-2 2z" /><path d="M8 4v2M7 5h2M19 15v2M18 16h2" /></svg>
  ),
  Refresh: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M20 11a8 8 0 10-2.3 5.7" /><path d="M20 4.5V11h-6.5" /></svg>
  ),
  Grid: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M4 12h16M12 4v16" /></svg>
  ),
  Users: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="9" cy="9" r="3.3" /><path d="M3 19.5c.8-3 3.2-4.6 6-4.6s5.2 1.6 6 4.6" /><circle cx="17" cy="8" r="2.6" /><path d="M16.5 13.2c2.4.2 4 1.7 4.5 4.3" /></svg>
  ),
  Camera: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M4 8.5A2.5 2.5 0 016.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0120 8.5v9A2.5 2.5 0 0117.5 20h-11A2.5 2.5 0 014 17.5z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
  ),
  Play: ({ size, ...r }: P) => <svg {...base(size, r)}><path d="M8 5.5v13l10-6.5z" fill="currentColor" /></svg>,
  Heart: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.4 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z" /></svg>
  ),
  Bulb: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" /></svg>
  ),
  More: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="18" cy="12" r="1.2" fill="currentColor" /></svg>
  ),
  Copy: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6.5A2.5 2.5 0 0013.5 4h-7A2.5 2.5 0 004 6.5v7A2.5 2.5 0 006.5 16H8" /></svg>
  ),
  Globe: ({ size, ...r }: P) => (
    <svg {...base(size, r)}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.6 5.4 3.6 8.5s-1.1 5.9-3.6 8.5c-2.5-2.6-3.6-5.4-3.6-8.5s1.1-5.9 3.6-8.5z" /></svg>
  ),
};
