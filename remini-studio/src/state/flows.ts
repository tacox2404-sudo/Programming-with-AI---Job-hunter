import { useCallback } from 'react';
import { A, CAMERA_ROLL, TRENDS } from './data';
import { useStore } from './store';
import type { ResultKind } from './types';

/** Multi-step user flows shared by several screens. */
export function useFlows() {
  const s = useStore();
  const { push, pop, replaceTop, runGenerating, track, mode, useFreeEnhancement } = s;

  const enhancePhoto = useCallback(() => {
    push({
      name: 'picker',
      title: 'Choose a photo to enhance',
      max: 1,
      cta: 'Enhance',
      onDone: (picked) => {
        const src = picked[0] ?? A.enhanceSrc;
        // Keep the demo headshot as the result so the LinkedIn story reads well.
        const image = src.startsWith('me_ref') ? A.enhanceSrc : src;
        runGenerating({ steps: ['Uploading', 'Enhancing details', 'Restoring faces'], duration: 1800, preview: image }, () => {
          useFreeEnhancement();
          track('enhance_completed');
          replaceTop({ name: 'result', kind: 'enhance', image, title: 'Enhanced' });
        });
      },
    });
  }, [push, replaceTop, runGenerating, track, useFreeEnhancement]);

  /** Studio path: use a saved identity, no upload. */
  const tryTrendWithIdentity = useCallback(
    (trendId: string, identityName = 'Me', replace = false) => {
      const t = TRENDS.find((x) => x.id === trendId) ?? TRENDS[0];
      runGenerating({ steps: [`Using identity "${identityName}"`, `Styling ${t.title}`, 'Final touches'], duration: 2000, preview: t.result }, () => {
        track('trend_applied_from_studio', 'w');
        const r = { name: 'result' as const, kind: 'trend' as const, image: t.result, title: t.title, trendId: t.id };
        if (replace) replaceTop(r);
        else push(r);
      });
    },
    [push, replaceTop, runGenerating, track],
  );

  /** Today path: upload 8–12 selfies every time, wait for a model. */
  const tryTrendToday = useCallback(
    (trendId: string) => {
      const t = TRENDS.find((x) => x.id === trendId) ?? TRENDS[0];
      push({
        name: 'picker',
        title: 'Upload 8–12 selfies',
        max: 12,
        preselectAll: true,
        pool: CAMERA_ROLL.filter((c) => c.startsWith('me_')),
        cta: 'Continue',
        onDone: () => {
          runGenerating({ steps: ['Uploading 8 selfies', 'Training your model', `Generating ${t.title}`], duration: 2500, preview: t.result }, () => {
            track('trend_generated_today');
            replaceTop({ name: 'result', kind: 'trend', image: t.result, title: t.title, trendId: t.id });
          });
        },
      });
    },
    [push, replaceTop, runGenerating, track],
  );

  const openTrend = useCallback(
    (trendId: string, direct = false) => {
      if (direct && mode === 'studio') return tryTrendWithIdentity(trendId);
      push({ name: 'trend', trendId });
    },
    [mode, push, tryTrendWithIdentity],
  );

  /** Generic single-photo tool (filters, retouch, videos). */
  const quickTool = useCallback(
    (title: string, kind: ResultKind, image: string, video = false) => {
      push({
        name: 'picker',
        title: `${title}: choose a photo`,
        max: 1,
        cta: 'Continue',
        onDone: (picked) => {
          const src = picked[0] ?? image;
          runGenerating({ steps: ['Uploading', `Applying ${title}`, 'Almost there'], duration: 1800, preview: src }, () => {
            track(video ? 'video_generated' : 'tool_used');
            if (video) replaceTop({ name: 'animate', src, projectId: '' });
            else replaceTop({ name: 'result', kind, image: kind === 'look' ? image : src, title });
          });
        },
      });
    },
    [push, replaceTop, runGenerating, track],
  );

  return { enhancePhoto, tryTrendWithIdentity, tryTrendToday, openTrend, quickTool, pop };
}
