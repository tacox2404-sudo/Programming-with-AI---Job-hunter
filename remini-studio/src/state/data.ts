import type { Identity, Look, Project, ProjectPhoto, SavedLook, Trend } from './types';

/**
 * Image references are file names inside `public/assets/`. A reference can list
 * fallbacks separated by "|": the first file that loads wins, otherwise a
 * gradient placeholder is drawn.
 */
export const A = {
  ref: (n: number) => `me_ref_${n}.jpg`,
  look: (n: number) => `me_look_${n}.jpg`,
  linkedin: (n: number) => `linkedin_${n}.jpg`,
  old: (n: number) => `archive_old_${n}.jpg`,
  restored: (n: number) => `archive_restored_${n}.jpg`,
  trip: (n: number) => `trip_${n}.jpg`,
  y2kMe: 'trend_y2k_me.jpg',
  marta: 'friend_marta.jpg',
  enhanceSrc: 'enhance_after.jpg|me_ref_1.jpg',
};

export const TRENDS: Trend[] = [
  { id: 'y2k', title: 'Y2K Yearbook', tagline: 'Glossy 2000s portrait day', cover: 'pack_y2k.jpg|trend_y2k_me.jpg', result: A.y2kMe, hot: true },
  { id: 'oldmoney', title: 'Old Money', tagline: 'Quiet luxury, linen and sun', cover: 'pack_oldmoney.jpg', result: A.look(1) },
  { id: 'film90s', title: '90s Film', tagline: 'Grain, flash, disposable', cover: 'pack_film90s.jpg', result: A.look(5) },
  { id: 'neon', title: 'Neon Nights', tagline: 'Tokyo after midnight', cover: 'pack_neon.jpg', result: A.look(2) },
  { id: 'renaissance', title: 'Renaissance', tagline: 'Oil on canvas, 1504', cover: 'pack_renaissance.jpg', result: A.look(4) },
  { id: 'chalet', title: 'Ski Chalet', tagline: 'Snow, knitwear, fire', cover: 'pack_chalet.jpg', result: A.look(6) },
];

export const IDENTITIES: Identity[] = [
  { id: 'me', name: 'Me', subtitle: 'Default · 4 photos', cover: A.ref(1), refs: [1, 2, 3, 4].map(A.ref) },
  { id: 'me-pro', name: 'Me · Professional', subtitle: 'Studio light · 4 photos', cover: `${A.linkedin(1)}|${A.ref(2)}`, refs: [2, 1, 4, 3].map(A.ref) },
];

export const LOOKS: Look[] = [
  { id: 'l1', src: A.look(1), title: 'Old Money', category: 'trend', identityId: 'me', when: '3 weeks ago' },
  { id: 'l2', src: A.look(2), title: 'Neon Nights', category: 'trend', identityId: 'me', when: '2 weeks ago' },
  { id: 'l3', src: A.look(3), title: 'Golden hour · Rome', category: 'casual', identityId: 'me', when: '2 days ago' },
  { id: 'l4', src: A.look(4), title: 'Renaissance', category: 'trend', identityId: 'me', when: '1 month ago' },
  { id: 'l5', src: A.look(5), title: '90s Film', category: 'trend', identityId: 'me', when: '1 week ago' },
  { id: 'l6', src: A.look(6), title: 'Ski Chalet', category: 'casual', identityId: 'me', when: '1 month ago' },
  { id: 'l7', src: A.look(7), title: 'Headshot · grey', category: 'professional', identityId: 'me-pro', when: '1 week ago' },
  { id: 'l8', src: A.look(8), title: 'Headshot · window', category: 'professional', identityId: 'me-pro', when: '1 week ago' },
];

export const SAVED_LOOKS: SavedLook[] = [
  { id: 's1', title: 'Studio light · navy blazer', cover: `${A.linkedin(2)}|${A.look(7)}`, identityId: 'me-pro' },
  { id: 's2', title: 'Golden hour · Rome', cover: A.look(3), identityId: 'me' },
  { id: 's3', title: 'Film grain · 35mm', cover: A.look(5), identityId: 'me' },
];

export const CAMERA_ROLL: string[] = [
  ...[1, 2, 3, 4].map(A.ref),
  ...[1, 2, 3, 4, 5, 6, 7, 8].map(A.trip),
  ...[1, 2, 3, 4, 5, 6].map(A.old),
  A.marta,
  ...[1, 2, 3, 4, 5].map(A.look),
];

export const TEMPLATES: { id: 'profile' | 'archive' | 'trip' | 'couple'; title: string; sub: string; cover: string; emoji: string }[] = [
  { id: 'profile', title: 'Profile refresh', sub: 'LinkedIn · dating · socials', cover: `${A.linkedin(1)}|${A.look(7)}`, emoji: '💼' },
  { id: 'archive', title: 'Family archive', sub: 'Restore and animate old photos', cover: A.restored(1), emoji: '🎞️' },
  { id: 'trip', title: 'Trip or event', sub: 'One consistent look for a set', cover: A.trip(2), emoji: '✈️' },
  { id: 'couple', title: 'Couple / friends shoot', sub: 'Two identities, one scene', cover: A.marta, emoji: '👯' },
];

let pid = 0;
export const photo = (original: string, status: ProjectPhoto['status'], enhanced?: string): ProjectPhoto => ({
  id: `ph${++pid}`,
  original,
  enhanced,
  status,
});

const cycle = <T,>(arr: T[], n: number) => Array.from({ length: n }, (_, i) => arr[i % arr.length]);

export const LINKEDIN_SETUP = {
  name: 'Studio light · navy blazer',
  style: 'Studio headshot, soft key light',
  background: 'Warm grey seamless',
  outfit: 'Navy blazer, white shirt',
  prompt: 'Professional headshot of {identity}, shoulders up, relaxed smile, 85mm, shallow depth of field',
};

export function seedProjects(): Project[] {
  const tripPhotos = cycle([1, 2, 3, 4, 5, 6, 7, 8].map(A.trip), 24).map((src, i) => photo(src, i < 18 ? 'enhanced' : 'original'));
  const archivePhotos = cycle([1, 2, 3, 4, 5, 6], 24).map((n, i) => photo(A.old(n), i < 6 ? 'enhanced' : 'original', A.restored(n)));
  const summerPhotos = cycle([5, 6, 7, 8, 1, 2].map(A.trip), 12).map((src) => photo(src, 'enhanced'));
  return [
    {
      id: 'rome',
      title: 'Rome weekend',
      template: 'trip',
      identityId: 'me',
      cover: A.trip(1),
      photos: tripPhotos,
      looks: [
        { id: 'rl1', src: A.look(3), title: 'Golden hour · Rome', category: 'casual', identityId: 'me', when: '2 days ago' },
      ],
      setup: {
        name: 'Golden hour · Rome',
        style: 'Warm film, late sun',
        background: 'Keep original',
        outfit: 'Keep original',
        prompt: 'Golden hour light, warm tones, soft grain, consistent across the set',
      },
      lastEdit: '2 days ago',
      nextStep: 'Enhance the last 6 photos to finish the set',
    },
    {
      id: 'nonna',
      title: "Nonna's album",
      template: 'archive',
      identityId: 'me',
      cover: `${A.restored(1)}|${A.old(1)}`,
      photos: archivePhotos,
      looks: [],
      setup: {
        name: 'Faithful restore',
        style: 'Restore, keep period look',
        background: 'Keep original',
        outfit: 'Keep original',
        prompt: 'Repair scratches and fading, sharpen faces, subtle colorization',
      },
      lastEdit: '5 days ago',
      nextStep: 'Animate a memory: try the 1962 wedding photo',
    },
    {
      id: 'summer',
      title: "Summer '26",
      template: 'trip',
      identityId: 'me',
      cover: A.trip(5),
      photos: summerPhotos,
      looks: [],
      setup: null,
      lastEdit: '1 hour ago',
      nextStep: 'Add your photos from the trip',
      shared: {
        owner: 'Marta',
        collaborators: ['Marta', 'Luca', 'Sofia', 'Ben'],
        link: 'remini.app/p/summer26',
        feed: [
          { who: 'Marta', text: 'added 6 photos', when: '1h' },
          { who: 'Luca', text: 'enhanced 4 photos', when: '3h' },
          { who: 'Sofia', text: 'applied "Golden hour" to the set', when: 'Yesterday' },
          { who: 'Ben', text: 'joined from the web link', when: '2d' },
        ],
      },
    },
  ];
}

export function linkedInPhotos(first: string): ProjectPhoto[] {
  const pool = CAMERA_ROLL.filter((s) => !s.startsWith('archive'));
  return [photo(first, 'enhanced'), ...cycle(pool, 23).map((s) => photo(s, 'original'))];
}

/** Photos Studio suggests from Recents for a template (faces matched to the identity). */
export function suggestFor(template: 'profile' | 'archive' | 'trip' | 'couple'): string[] {
  const nonArchive = CAMERA_ROLL.filter((s) => !s.startsWith('archive'));
  if (template === 'profile') return cycle(nonArchive, 23);
  if (template === 'archive') return [1, 2, 3, 4, 5, 6].map(A.old);
  if (template === 'trip') return [1, 2, 3, 4, 5, 6, 7, 8].map(A.trip);
  return [A.marta, A.ref(2), A.ref(3), A.trip(4)];
}
