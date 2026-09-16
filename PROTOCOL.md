# Protocol: the two repeatable processes

This project has two independent pipelines, not one. Keeping them separate is
deliberate — a profile update should never depend on job ingestion having run,
and job ingestion should never depend on any one user's profile existing.

## 1. Profile lifecycle (per user)

```
create → CV/LinkedIn paste (optional, repeatable) → structured fields (manual, repeatable)
       → export profile.json → [later] import profile.json → back to structured fields
```

- **Storage today:** `localStorage`, one profile per browser, under the key
  `jobHunterProfile.v3` (versioned — a future schema change bumps this key
  rather than silently reinterpreting old data).
- **Repeat entry points:**
  - The CV-paste scanner (`initCvScan` in `app.js`) can be re-run any time;
    it only ever *suggests* additions and skips anything already present, so
    running it again with an updated CV doesn't duplicate or overwrite what's
    already confirmed.
  - **Import profile.json** (new): load a previously exported file back in —
    on the same browser after clearing storage, on a different device, or a
    file someone else produced with this same tool. Does a full replace (with
    confirmation), not a field merge — merging two different profiles
    automatically is far more likely to produce a confusing hybrid than a
    clean, explicit replace is to lose something you wanted kept.
- **What "multiple users" means right now:** every browser that opens
  `index.html` gets its own independent profile — that part already works,
  with zero setup. What it does *not* do is give anyone (a recruiter, an
  admin, the system itself) a shared view across users, sync across a single
  user's own devices, or survive a cleared cache. That needs real accounts
  and server-side storage — a genuine infrastructure decision (hosting,
  database, auth provider), not something a script works around. Flagging it
  here rather than building around it silently.

## 2. Job posting lifecycle (shared dataset)

```
scripts/ingest-jobs.js (scheduled) → classify → dedupe/merge by stable id
       → data/jobs.json → jobs.html fetches it (falls back to data/jobs.seed.json)
```

- **Source of truth:** `data/jobs.json`. Never hand-edited — it's the merged
  output of every ingestion run. `data/jobs.seed.json` is the original 18
  hand-authored sample postings, used only as a fallback when `data/jobs.json`
  doesn't exist yet or is empty (e.g. before the pipeline has ever run).
- **The pipeline:** `scripts/ingest-jobs.js` fetches from a few free, keyless
  job-board APIs (Remotive, Arbeitnow, The Muse), classifies each posting's
  `role_family` / `seniority` against the controlled vocabularies in
  `taxonomies.js` (unclassifiable postings are left blank, not guessed at),
  and merges into `data/jobs.json` by a stable `source:external_id` — so
  running it again appends new postings and refreshes existing ones instead
  of duplicating or replacing the file.
- **Fields these free sources don't reliably give us** (`company_industry`,
  `pay_bracket`, `visa_sponsorship`) are left unset (`""` / `null`) rather
  than inferred from the company name or title — a wrong guess there is worse
  than an honest blank the UI just can't filter on. `visa_sponsorship` is a
  real tri-state now: `true` / `false` / `null` (unknown) — `null` must never
  be treated as `false` (see the dealbreaker check in `jobs.js`).
- **Scheduling:** `.github/workflows/ingest-jobs.yml` runs this daily via
  GitHub Actions and commits the result back to the branch. That's the actual
  "content doesn't stay static" mechanism, running on GitHub's infrastructure
  independent of any particular Claude Code session.

### Why this doesn't run live in a Claude Code session

Every outbound call this pipeline makes was tested directly from this
environment and rejected identically:

```
CONNECT tunnel failed, response 403 — gateway answered 403 to CONNECT
(policy denial or upstream failure)
```

on Remotive, Arbeitnow, The Muse, RemoteOK, USAJobs, and Adzuna. That's the
environment's outbound network policy (an org-level allowlist), not a
per-domain fluke — it's the same class of block that stopped a direct fetch
of the base44 demo URL earlier in this project. It means:

- `node scripts/ingest-jobs.js` (the real, network-calling path) can't be run
  or verified *from inside this session* — only from CI (GitHub Actions has
  normal internet access) or on a machine with normal internet access.
- `node scripts/ingest-jobs.js --test` *can* run here — it exercises the
  classify/dedupe/merge logic against local fixtures
  (`scripts/fixtures/sample-api-responses.js`), zero network calls, zero
  writes to the real data file. That's the "validate structure before
  depending on something live" step for this half of the system, same
  principle used everywhere else in this project (deterministic normalize
  functions instead of a real AI call, a static sample dataset before a real
  feed). It was run and passed before this pipeline was committed.
- If you want live fetching to work directly inside a Claude Code session
  (not just via the scheduled Action), that's a property of the *environment's*
  network policy, configured when the environment was created — see
  https://code.claude.com/docs/en/claude-code-on-the-web.

### "Almost every job posting in the world"

Worth naming directly: no free API gets you this, and no paid one does
either — not even LinkedIn or Indeed have literally every posting, and both
require commercial partnership agreements to access at all (not something a
script can sign up for). Adding more sources over time (an Adzuna key, a
paid aggregator, direct company career-page feeds) is how coverage grows —
each new source is another entry in the `SOURCES` array in
`scripts/ingest-jobs.js`, merged by the same dedupe key, no architecture
change required. "Comprehensive" here means "growing and deduped," not
"complete."
