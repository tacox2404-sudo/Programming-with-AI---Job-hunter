# Remini Studio · clickable concept prototype

A high-fidelity mobile prototype for a proposed Remini feature: **Studio**, a personal creative space built on the identity tech Remini already has. Trends still acquire users, but every trend, enhancement and look now lands somewhere the user comes back to.

This is a design concept, not the real app. It uses a text wordmark, a neutral stand-in app icon and no real Remini assets. All AI results are simulated (a 1.8–2.5 s "generating" animation, then a prepared image).

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

`npm run build` produces a **single self-contained `dist/index.html`** (JS, CSS and the Inter font are inlined). You can open it straight from disk, zip `dist/` and send it, or drop `dist/` on Vercel or Netlify with no config. Images are loaded from `dist/assets/`, which is copied from `public/assets/`.

On desktop the app sits in a 390×844 phone frame with the controls around it. On a real phone (width ≤ 500 px) it goes full screen and the controls move behind a small floating button.

## Adding your images

Drop JPGs into `public/assets/` with these names, then rebuild. Any missing file falls back to a generated gradient placeholder with initials, so the app never breaks and you can add images gradually.

| File | Used for |
|---|---|
| `me_ref_1.jpg` … `me_ref_4.jpg` | Reference selfies of the "Me" identity, selfie picker |
| `me_look_1.jpg` … `me_look_8.jpg` | Generated looks of you (identity page, pack results, filters) |
| `trend_y2k_me.jpg` | Y2K Yearbook rendered on you (the trend result and weekly banner) |
| `linkedin_1.jpg` … `linkedin_4.jpg` | Generated LinkedIn looks in the "LinkedIn refresh" project |
| `archive_old_1.jpg` … `archive_old_6.jpg` | Old family photos (before) |
| `archive_restored_1.jpg` … `archive_restored_6.jpg` | The same photos restored (after) |
| `trip_1.jpg` … `trip_8.jpg` | Trip photos ("Rome weekend", "Summer '26", lock-screen wallpaper) |
| `friend_marta.jpg` | Marta, the collaborator |

Optional extras (placeholders are used otherwise):

| File | Used for |
|---|---|
| `enhance_after.jpg` | The headshot shown as the enhance result (falls back to `me_ref_1.jpg`) |
| `pack_y2k.jpg`, `pack_oldmoney.jpg`, `pack_film90s.jpg`, `pack_neon.jpg`, `pack_renaissance.jpg`, `pack_chalet.jpg` | Pack covers on the Home feed in "Today" mode |

For enhance results without a separate "before" file, the before side of the slider is the same image rendered blurred and desaturated.

## Presenting

Controls outside the phone:

- **Experience: Today / With Studio.** Today is the current app: a home feed of packs, the face model buried in AI Photos, results that can only be saved to the gallery. With Studio adds the Studio tab (first position, NEW dot) and everything below.
- **Show levers.** Adds small tags to key UI elements and opens an event log that records what you click, e.g. `project_created → t`.
  - **t** trial start · **c** trial-to-paid conversion · **w** paid weeks (retention) · **I** installs
- **Start demo.** The guided tour below, with a caption card and a highlight on the element to tap. `→` next, `←` back, `Esc` exit. You can also click inside the app at any point; each demo beat resets the app to a known state, so jumping around never breaks it.
- **Lock screen** jumps to the notifications screen. **Reset** restores the seed data.

### Guided demo path (9 steps, 18 beats)

1. **Today:** tap the Y2K Yearbook trend, upload selfies, get a result whose only exit is Save to Gallery. Back home nothing persists and the model sits unused in AI Photos.
2. **With Studio:** open the new Studio tab.
3. **Identities:** "the tech already exists; we bring it to the front". Identity page with reference photos, a likeness tip and privacy controls.
4. **Create "LinkedIn refresh"** from a just-enhanced photo through the "Save to a Project?" sheet, the entry point in the flow most users already use.
5. **Free limit on "Enhance all 24"** → paywall framed as "Finish your project: unlimited enhancements and your Studio, 7 days free" (same trial-then-weekly plan) → back in the project, all photos processing. **(t)**
6. **Project page:** the saved setup (style, background, outfit, prompt) with "Re-run setup on a new photo" and "Generate 4 more looks". **(c)**
7. **A trend drops:** the Home card says "Try with Me" (no re-upload) → result → Save to Studio → it appears on Studio home under the identity. **(w)**
8. **Lock-screen notifications** bring the user back; each deep-links to the right screen. **(w)**
9. **Share "Summer '26"** (link, collaborators, contributions feed) → the recipient's web view: "Marta invited you" → Join and add your photos → Get the app. **(I)**

### Screenshots

`screenshots/NN-*.png` has the phone for every demo beat, and `screenshots/full/` has the whole window with levers on. After adding your own images, regenerate them:

```bash
npm run build && npm run screenshots
```

The script uses Playwright's Chromium (`npx playwright install chromium` if it isn't installed; set `CHROMIUM_PATH` to use another binary).

## How it's built

React 18 + TypeScript + Vite + Tailwind CSS + Framer Motion. No backend, all state in memory.

```
src/
  state/
    types.ts      Route, Sheet, Project, Identity, Look… (the state model)
    data.ts       Seed data and asset names (identities, looks, projects, trends)
    store.tsx     React context: navigation stack, sheets, generating overlay,
                  analytics log, domain actions (createProject, enhanceAll,
                  startTrial, generateLooks, rerunSetup, joinShared…)
    flows.ts      Multi-step flows shared by screens (enhance, trend Today vs Studio)
    demo.ts       The guided demo: each beat sets a known app state + a target to highlight
  components/     Phone chrome (status bar, top bar, bottom nav), Img with placeholder
                  fallback, before/after slider, sheets, generating overlay, spotlight
  screens/        Tabs (Enhance home, AI Photos, Filters, Videos, Retouch), Studio home,
                  Identity, New project, Project + photo viewer, Result, Trend, Picker,
                  Lock screen, Web recipient, Sheets (save-to-project, paywall, share…)
  shell/          Controls, event log and demo caption outside the phone
```

State model in short: `mode` (today | studio), `tab`, a navigation `stack` of typed routes (every layer stays mounted so screens keep their local state behind a picker), one optional `sheet`, one optional `generating` overlay, domain data (`identities`, `looks`, `projects`, `savedLooks`), plan flags (`freeUsed` of 5, `isPro`), `events` for the lever log, and `demo` (current beat or null).
