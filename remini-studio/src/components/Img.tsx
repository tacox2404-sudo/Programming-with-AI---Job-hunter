import { useState, type CSSProperties } from 'react';

const BASE = import.meta.env.BASE_URL;
const failed = new Set<string>();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return Math.abs(h);
}

function initials(name: string) {
  const base = name.replace(/\.[a-z]+$/, '');
  if (base.startsWith('trend_y2k')) return 'Y2K';
  if (base.startsWith('friend_')) return base.slice(7, 8).toUpperCase();
  if (base.startsWith('pack_')) return base.slice(5, 7).toUpperCase();
  if (base.startsWith('linkedin')) return 'IN';
  if (base.startsWith('archive_old')) return '19' + (60 + (hash(base) % 20));
  if (base.startsWith('archive_restored')) return 'RE';
  if (base.startsWith('trip')) return 'TR';
  return 'ME';
}

type Kind = 'portrait' | 'old' | 'restored' | 'landscape';
function kindOf(name: string): Kind {
  if (name.startsWith('archive_old')) return 'old';
  if (name.startsWith('archive_restored')) return 'restored';
  if (name.startsWith('trip')) return 'landscape';
  return 'portrait';
}

/** Tasteful generated stand-in so the prototype never shows a broken image. */
export function Placeholder({ name, label = true }: { name: string; label?: boolean }) {
  const h = hash(name);
  const kind = kindOf(name);
  const hue = kind === 'old' ? 32 : kind === 'restored' ? 20 + (h % 30) : h % 360;
  const hue2 = (hue + 40 + (h % 60)) % 360;
  const sat = kind === 'old' ? 22 : 62;
  const bg =
    kind === 'old'
      ? `radial-gradient(120% 90% at 50% 30%, hsl(38 30% 62%), hsl(30 25% 32%) 70%, hsl(25 20% 16%))`
      : `radial-gradient(90% 70% at ${20 + (h % 60)}% ${15 + (h % 30)}%, hsl(${hue2} ${sat}% 62% / .95), transparent 70%),
         linear-gradient(${h % 360}deg, hsl(${hue} ${sat}% 34%), hsl(${hue2} ${sat - 10}% 16%))`;
  const fg = kind === 'old' ? 'rgba(40,28,18,.55)' : 'rgba(10,10,15,.38)';
  return (
    <div className="absolute inset-0" style={{ background: bg }}>
      {kind === 'landscape' ? (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
          <circle cx={30 + (h % 40)} cy="34" r="9" fill="rgba(255,240,210,.55)" />
          <path d={`M0 72 Q 25 ${52 + (h % 12)} 50 66 T 100 ${58 + (h % 10)} V100 H0Z`} fill="rgba(10,10,15,.35)" />
          <path d="M0 84 Q 35 70 60 82 T 100 78 V100 H0Z" fill="rgba(10,10,15,.45)" />
        </svg>
      ) : (
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax meet" className="absolute inset-x-0 bottom-0 h-[82%] w-full">
          <circle cx="50" cy="42" r="17" fill={fg} />
          <path d="M14 100 C 16 74, 32 64, 50 64 C 68 64, 84 74, 86 100 Z" fill={fg} />
        </svg>
      )}
      {kind === 'old' && <div className="absolute inset-0 grain opacity-60 mix-blend-multiply" />}
      {label && (
        <span className="absolute left-2 top-2 rounded-md bg-black/25 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white/70 backdrop-blur-sm">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export const DEGRADE = 'blur(1.4px) saturate(0.5) contrast(0.82) brightness(0.9) sepia(0.15)';

interface Props {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  degrade?: boolean;
  label?: boolean;
  imgClassName?: string;
}

/** Loads `public/assets/<file>`, trying "|"-separated fallbacks, then a placeholder. */
export function Img({ src, alt = '', className = '', style, degrade, label = true, imgClassName = '' }: Props) {
  const candidates = src.split('|').filter(Boolean);
  const [bump, setBump] = useState(0);
  const current = candidates.find((c) => !failed.has(c));
  const filter = degrade ? { filter: DEGRADE } : undefined;
  return (
    <div className={`${/\b(absolute|fixed)\b/.test(className) ? '' : 'relative'} overflow-hidden bg-card2 ${className}`} style={style}>
      {current ? (
        <img
          key={current}
          src={`${BASE}assets/${current}`}
          alt={alt}
          draggable={false}
          onError={() => {
            failed.add(current);
            setBump(bump + 1);
          }}
          className={`absolute inset-0 h-full w-full object-cover ${imgClassName}`}
          style={filter}
        />
      ) : (
        <div className="absolute inset-0" style={filter}>
          <Placeholder name={candidates[candidates.length - 1] ?? 'x'} label={label} />
        </div>
      )}
      {degrade && <div className="pointer-events-none absolute inset-0 grain opacity-40" />}
    </div>
  );
}
