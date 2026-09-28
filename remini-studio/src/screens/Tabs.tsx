import { A, TRENDS } from '../state/data';
import { useFlows } from '../state/flows';
import { useStore } from '../state/store';
import { BeforeAfter } from '../components/BeforeAfter';
import { TopBar } from '../components/Chrome';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { HScroll, LeverTag, NewBadge, PillWhite, SectionHeader } from '../components/ui';

function TrendCard({ id, big }: { id: string; big?: boolean }) {
  const { mode } = useStore();
  const { openTrend } = useFlows();
  const t = TRENDS.find((x) => x.id === id)!;
  const studio = mode === 'studio';
  return (
    <div
      data-demo={big ? 'trend-card' : undefined}
      onClick={() => openTrend(id)}
      className={`relative shrink-0 cursor-pointer overflow-hidden rounded-[20px] bg-card ${big ? 'h-[300px] w-[240px]' : 'h-[210px] w-[150px]'}`}
    >
      <Img src={studio && big ? t.result : t.cover} className="absolute inset-0" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
      {t.hot && <span className="absolute left-3 top-3 rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold">🔥 Trending</span>}
      <div className="absolute inset-x-0 bottom-0 p-3">
        <div className={`font-bold leading-tight ${big ? 'text-[20px]' : 'text-[15px]'}`}>{t.title}</div>
        <div className="mt-0.5 text-[12px] text-white/70">{t.tagline}</div>
        {big && (
          <button
            data-demo="trend-cta"
            onClick={(e) => {
              e.stopPropagation();
              openTrend(id, true);
            }}
            className="relative mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white text-[14px] font-semibold text-black active:scale-[0.98]"
          >
            {studio ? (
              <>
                <Img src={A.ref(1)} className="h-5 w-5 rounded-full" label={false} /> Try with Me
              </>
            ) : (
              'Try now'
            )}
            {studio && <LeverTag l="w" />}
          </button>
        )}
      </div>
    </div>
  );
}

export function EnhanceHome() {
  const { mode, push } = useStore();
  const { enhancePhoto } = useFlows();
  const grid = (title: string) => push({ name: 'grid', title, items: TRENDS.map((t) => ({ src: t.cover, title: t.title })) });
  return (
    <div>
      <TopBar />
      <div className="px-4 pt-2">
        <div className="relative overflow-hidden rounded-[22px] bg-card">
          <BeforeAfter after={A.enhanceSrc} className="h-[230px]" />
          <div className="flex items-center justify-between gap-3 p-4">
            <div>
              <div className="text-[18px] font-bold">Enhance</div>
              <div className="text-[13px] text-mute">Sharpen, restore, bring faces back</div>
            </div>
            <button data-demo="enhance-cta" onClick={enhancePhoto} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-5 text-[15px] font-semibold text-black active:scale-95">
              <I.Enhance size={18} /> Enhance
            </button>
          </div>
        </div>
      </div>

      {mode === 'studio' && (
        <button onClick={() => push({ name: 'identity', id: 'me' })} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-white/[0.06] p-3 text-left">
          <Img src={A.ref(1)} className="h-10 w-10 rounded-full" label={false} />
          <div className="flex-1 text-[13px] leading-snug text-white/80">
            Trends now use <b className="text-white">Me</b>. No re-upload, results land in your Studio.
          </div>
          <I.Chevron size={18} className="text-mute" />
        </button>
      )}

      <SectionHeader title={<>Trending now</>} onSeeAll={() => grid('Trending now')} />
      <HScroll>
        <TrendCard id="y2k" big />
        <TrendCard id="oldmoney" />
        <TrendCard id="film90s" />
      </HScroll>

      <SectionHeader title="AI Photos packs" onSeeAll={() => grid('AI Photos packs')} />
      <HScroll>
        {['neon', 'renaissance', 'chalet', 'oldmoney'].map((id) => (
          <TrendCard key={id} id={id} />
        ))}
      </HScroll>
      <div className="h-28" />
    </div>
  );
}

export function AIPhotosTab() {
  const { mode, goTab } = useStore();
  const { openTrend } = useFlows();
  return (
    <div>
      <TopBar />
      <h1 className="px-4 pb-1 pt-3 text-[28px] font-bold tracking-tight">AI Photos</h1>
      <p className="px-4 text-[14px] text-mute">Pick a pack and see yourself in it.</p>
      {mode === 'studio' && (
        <button onClick={() => goTab('studio')} className="mx-4 mt-4 flex w-[calc(100%-2rem)] items-center justify-between rounded-2xl bg-brand/15 p-3.5 text-left ring-1 ring-[#FF2E7E]/30">
          <span className="text-[14px] font-semibold">Your identities now live in Studio</span>
          <I.Chevron size={18} />
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 px-4 pt-5">
        {TRENDS.map((t) => (
          <button key={t.id} onClick={() => openTrend(t.id)} className="relative h-[220px] overflow-hidden rounded-[18px] text-left">
            <Img src={t.cover} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
            <div className="absolute bottom-0 p-3">
              <div className="flex items-center gap-1.5 text-[15px] font-bold">
                {t.title} {t.hot && <NewBadge />}
              </div>
              <div className="text-[12px] text-white/70">{t.tagline}</div>
            </div>
          </button>
        ))}
      </div>
      {mode === 'today' && (
        <div data-demo="buried-models" className="mx-4 mt-8 rounded-2xl border border-white/[0.06] p-3.5">
          <div className="text-[12px] font-semibold uppercase tracking-wider text-mute">Your models</div>
          <div className="mt-2.5 flex items-center gap-3">
            <Img src={A.ref(1)} className="h-11 w-11 rounded-xl" label={false} />
            <div className="flex-1">
              <div className="text-[14px] font-semibold">Model · Sep 12</div>
              <div className="text-[12px] text-mute">Used once for "Old Money" · expires in 23 days</div>
            </div>
          </div>
        </div>
      )}
      <div className="h-28" />
    </div>
  );
}

const FILTERS = [
  { t: 'Anime', src: 'me_look_2.jpg' },
  { t: 'Cartoon 3D', src: 'me_look_4.jpg' },
  { t: 'Pencil sketch', src: 'me_look_5.jpg' },
  { t: 'Watercolor', src: 'me_look_6.jpg' },
  { t: 'Comic', src: 'me_look_1.jpg' },
  { t: 'Clay', src: 'me_look_3.jpg' },
];

export function FiltersTab() {
  const { quickTool } = useFlows();
  return (
    <div>
      <TopBar />
      <h1 className="px-4 pb-1 pt-3 text-[28px] font-bold tracking-tight">AI Filters</h1>
      <p className="px-4 text-[14px] text-mute">One tap, a whole new style.</p>
      <div className="grid grid-cols-2 gap-3 px-4 pt-5">
        {FILTERS.map((f) => (
          <button key={f.t} onClick={() => quickTool(f.t, 'look', f.src)} className="relative h-[180px] overflow-hidden rounded-[18px] text-left">
            <Img src={f.src} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
            <div className="absolute bottom-3 left-3 text-[15px] font-bold">{f.t}</div>
          </button>
        ))}
      </div>
      <div className="h-28" />
    </div>
  );
}

export function VideosTab() {
  const { quickTool } = useFlows();
  const items = [
    { t: 'Animate a photo', s: 'Bring any portrait to life', src: A.restored(2) },
    { t: 'AI Hug', s: 'Two photos, one moment', src: A.marta },
    { t: 'Dance', s: 'Trending moves, your face', src: A.look(2) },
    { t: 'Age journey', s: 'From 5 to 85 in 10 seconds', src: A.ref(3) },
  ];
  return (
    <div>
      <TopBar />
      <h1 className="px-4 pb-1 pt-3 text-[28px] font-bold tracking-tight">AI Videos</h1>
      <p className="px-4 text-[14px] text-mute">Turn photos into moving moments.</p>
      <div className="space-y-3 px-4 pt-5">
        {items.map((v) => (
          <button key={v.t} onClick={() => quickTool(v.t, 'look', v.src, true)} className="relative flex h-[150px] w-full overflow-hidden rounded-[20px] text-left">
            <Img src={v.src} className="absolute inset-0" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent" />
            <div className="relative flex flex-col justify-end p-4">
              <span className="mb-auto grid h-9 w-9 place-items-center rounded-full bg-white/20 backdrop-blur"><I.Play size={16} /></span>
              <div className="text-[17px] font-bold">{v.t}</div>
              <div className="text-[13px] text-white/70">{v.s}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="h-28" />
    </div>
  );
}

export function RetouchTab() {
  const { quickTool } = useFlows();
  const tools = ['Remove objects', 'Smooth skin', 'Whiten teeth', 'Fix lighting', 'Change background', 'Remove blemishes'];
  return (
    <div>
      <TopBar />
      <h1 className="px-4 pb-1 pt-3 text-[28px] font-bold tracking-tight">Retouch</h1>
      <p className="px-4 text-[14px] text-mute">Precise edits, done by AI.</p>
      <div className="px-4 pt-5">
        <div className="relative h-[200px] overflow-hidden rounded-[20px]">
          <BeforeAfter after={A.ref(2)} className="h-full" />
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {tools.map((t) => (
            <button key={t} onClick={() => quickTool(t, 'enhance', A.ref(2))} className="flex h-[64px] items-center gap-2.5 rounded-2xl bg-card px-3.5 text-left text-[14px] font-semibold active:bg-card2">
              <I.Wand size={18} className="text-[#FF6A8E]" /> {t}
            </button>
          ))}
        </div>
        <PillWhite className="mt-5" onClick={() => quickTool('Retouch', 'enhance', A.ref(2))}>
          Start retouching
        </PillWhite>
      </div>
      <div className="h-28" />
    </div>
  );
}
