import { motion } from 'framer-motion';
import { A, CAMERA_ROLL } from '../state/data';
import { useStore } from '../state/store';
import { Wordmark } from '../components/Chrome';
import { I } from '../components/Icons';
import { Img } from '../components/Img';
import { Avatar, LeverTag, PillBrand, PillWhite } from '../components/ui';

function AppGlyph() {
  // Neutral stand-in app icon (not the real Remini logo).
  return (
    <span className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[10px] bg-[#0B0B0F] text-[15px] font-extrabold tracking-tight text-white ring-1 ring-white/10">
      <span className="bg-brand bg-clip-text text-transparent">R</span>
    </span>
  );
}

export function LockScreen() {
  const s = useStore();
  const { track, resetStack, ensureLinkedIn, generateLooks, projectsRef, setMode, mode, goTab } = s;

  const open = (which: 'linkedin' | 'marta' | 'y2k') => {
    track(`notification_opened_${which}`, 'w');
    if (mode !== 'studio') setMode('studio');
    if (which === 'linkedin') {
      const id = ensureLinkedIn();
      const p = projectsRef.current.find((x) => x.id === id);
      if (p && p.looks.length === 0) generateLooks(id, true);
      goTab('studio');
      resetStack([{ name: 'project', id, tab: 'looks' }]);
    } else if (which === 'marta') {
      goTab('studio');
      resetStack([{ name: 'project', id: 'summer' }]);
    } else {
      goTab('enhance');
      resetStack([{ name: 'trend', trendId: 'y2k' }]);
    }
  };

  const notes = [
    { k: 'linkedin' as const, title: 'Your LinkedIn set is ready', body: '4 new looks with Studio light · navy blazer', when: 'now', img: `${A.linkedin(1)}|${A.look(7)}` },
    { k: 'marta' as const, title: "Marta added 6 photos to Summer '26", body: 'Tap to see them and add yours', when: '1h ago', img: A.trip(6) },
    { k: 'y2k' as const, title: 'New this week: see Y2K Yearbook on you', body: 'Already rendered on Me. No upload needed.', when: '9:00', img: A.y2kMe },
  ];

  return (
    <div className="relative h-full overflow-hidden">
      <div className="absolute inset-0">
        <Img src={A.trip(3)} className="absolute inset-0 scale-110 blur-[2px]" label={false} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#1b1030]/70 via-[#0b0b0f]/40 to-[#0b0b0f]/80" />
      </div>
      <div className="relative flex h-full flex-col items-center pt-[64px]">
        <I.Lock size={18} className="text-white/80" />
        <div className="mt-2 text-[17px] font-semibold text-white/85">Tuesday 29 September</div>
        <div className="text-[92px] font-bold leading-[1] tracking-tight" style={{ fontFeatureSettings: '"tnum"' }}>
          9:41
        </div>
        <div className="mt-8 w-full space-y-2 px-3">
          {notes.map((n, i) => (
            <motion.button
              key={n.k}
              data-demo={`notif-${n.k}`}
              initial={{ opacity: 0, y: 20, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.25 + i * 0.25, type: 'spring', stiffness: 300, damping: 26 }}
              onClick={() => open(n.k)}
              className="relative flex w-full items-center gap-3 rounded-[22px] bg-white/[0.16] p-3 text-left backdrop-blur-2xl active:bg-white/25"
            >
              <AppGlyph />
              <div className="min-w-0 flex-1">
                <div className="flex justify-between text-[12px] text-white/60">
                  <span className="font-semibold uppercase tracking-wide">Remini</span>
                  <span>{n.when}</span>
                </div>
                <div className="truncate text-[14px] font-semibold">{n.title}</div>
                <div className="truncate text-[13px] text-white/75">{n.body}</div>
              </div>
              <Img src={n.img} className="h-10 w-10 shrink-0 rounded-lg" label={false} />
              <LeverTag l={n.k === 'marta' ? 'I' : 'w'} />
            </motion.button>
          ))}
        </div>
        <button onClick={() => resetStack([], -1)} className="mt-auto mb-7 flex flex-col items-center gap-2 text-[13px] text-white/60">
          Tap to unlock
          <span className="h-[5px] w-[134px] rounded-full bg-white" />
        </button>
      </div>
    </div>
  );
}

export function RecipientScreen() {
  const { pop, push, runGenerating, joinShared, track, resetStack, goTab, setMode, mode, projects } = useStore();
  const p = projects.find((x) => x.id === 'summer')!;
  const joined = p.shared?.collaborators.includes('You') ?? false;

  const join = () => {
    push({
      name: 'picker',
      title: 'Add your photos',
      max: 3,
      preselectAll: true,
      pool: [A.trip(7), A.trip(8), A.trip(2), A.ref(3), ...CAMERA_ROLL.slice(0, 6)],
      cta: 'Add to Summer ’26',
      onDone: (picked) => {
        pop();
        runGenerating({ steps: ['Uploading', 'Enhancing your photos', 'Adding to Summer ’26'], duration: 1800 }, () => {
          joinShared(picked);
        });
      },
    });
  };

  return (
    <div className="flex h-full flex-col bg-[#F4F4F6] text-black">
      {/* Browser chrome */}
      <div className="border-b border-black/10 bg-[#F4F4F6] px-3 pb-2">
        <div className="flex items-center gap-2">
          <button onClick={pop} className="grid h-8 w-8 place-items-center text-[#0A84FF]" aria-label="Close">
            <I.Close size={20} />
          </button>
          <div className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-black/[0.07] text-[14px]">
            <I.Lock size={12} /> remini.app/p/summer26
          </div>
          <span className="flex items-center gap-1 rounded-full bg-black/[0.07] px-2 py-1 text-[11px] font-semibold text-black/60">
            <I.Globe size={12} /> Web
          </span>
        </div>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="grid grid-cols-3 gap-0.5">
          {p.photos.slice(0, 6).map((ph, i) => (
            <Img key={ph.id} src={ph.original} className={`${i === 0 ? 'col-span-2 row-span-2' : ''} aspect-square`} label={false} />
          ))}
        </div>
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2">
            <Wordmark className="text-[20px]" />
            <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-black/50">Shared project</span>
          </div>
          {!joined ? (
            <>
              <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">Marta invited you to “Summer ’26”</h1>
              <div className="mt-3 flex items-center gap-2">
                <div className="flex -space-x-2">
                  {p.shared!.collaborators.map((c) => (
                    <Avatar key={c} name={c} size={30} className="shadow-[0_0_0_2px_#F4F4F6]" />
                  ))}
                </div>
                <span className="text-[13px] text-black/60">
                  {p.photos.length} photos · {p.shared!.collaborators.length} people
                </span>
              </div>
              <p className="mt-4 text-[14px] leading-relaxed text-black/65">Add your photos from the trip. Everyone's shots get enhanced with the same look, in one shared album. No app needed to join.</p>
            </>
          ) : (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight">You're in 🎉</h1>
              <p className="mt-2 text-[14px] leading-relaxed text-black/65">Your photos were enhanced and added to Summer ’26. Get the app to see yourself in the group looks and get notified when friends add more.</p>
            </motion.div>
          )}
        </div>
      </div>

      <div className="space-y-2.5 px-5 pb-6 pt-3">
        {!joined ? (
          <>
            <PillBrand demo="join" onClick={join}>
              Join and add your photos
              <LeverTag l="I" />
            </PillBrand>
            <p className="text-center text-[12px] text-black/45">Works in any browser · iOS · Android · web</p>
          </>
        ) : (
          <>
            <PillBrand
              onClick={() => {
                track('app_install_from_invite', 'I');
                if (mode !== 'studio') setMode('studio');
                goTab('studio');
                resetStack([{ name: 'project', id: 'summer' }]);
              }}
            >
              Get Remini · open the project
              <LeverTag l="I" />
            </PillBrand>
            <PillWhite className="!bg-black/[0.06] !text-black" onClick={pop}>
              Back
            </PillWhite>
          </>
        )}
      </div>
    </div>
  );
}
