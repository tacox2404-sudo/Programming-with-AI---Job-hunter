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

### Per-company coverage plan

Why a filter like "Bank of America" surfaces only 3 postings even though
the real company obviously has far more open roles: those 3 come from
generic aggregators (Arbeitnow/TheMuse) that happen to have re-posted
them, not from a source that actually reaches Bank of America's own
careers site. Nobody has entered Bank of America into the pipeline as a
first-class source yet — same story for every company not listed in
`COMPANY_BOARDS` / `WORKDAY_BOARDS` in `scripts/ingest-jobs.js`. This
matters because it's exactly what makes filtering work: with only a
scattered few of a company's postings in the dataset, filtering by that
company can never show "everything they have open," only the fraction an
aggregator happened to carry.

The fix isn't more registry entries (that's `data/registry/companies.json`
— it labels a company as real/verified for the "notable companies" filter,
it doesn't pull in any of that company's postings). It's giving that
company its own dedicated source, which means identifying which ATS
(applicant tracking system) actually runs its careers page and pointing
this pipeline at it directly. A guessed identifier is a bad substitute —
tried once already for 7 banks/corporates on Workday, guessing all three
required values (tenant/data-center/site) from general knowledge, and it
was 0-for-7 in a live CI run (see the pruned entries' commit history).
Guessing isn't a coverage strategy; visiting the real page once is.

**Steps to onboard one company** (repeat per company — this is the whole
"plan for every company," it just has to run once per company, by a
human who can actually browse to that company's real careers page from
an unrestricted network, since this sandbox's outbound access is blocked
and a wrong guess can't be told apart from a right one without a real
request):

1. Open the company's real, official careers/jobs page in a browser.
2. Note what happens to the URL once it loads the actual listings —
   the ATS behind it is visible in the resulting address:
   - `boards.greenhouse.io/<slug>` or `job-boards.greenhouse.io/<slug>` → Greenhouse. Need: `<slug>`.
   - `jobs.lever.co/<slug>` → Lever. Need: `<slug>`.
   - `<tenant>.<dc>.myworkdayjobs.com/en-US/<site>/...` (dc is usually `wd1`/`wd3`/`wd5`/`wd12`) → Workday. Need: `<tenant>`, `<dc>`, `<site>`, all three, read straight out of that URL.
   - Anything else (a custom-built portal, SuccessFactors, iCIMS, Taleo, SmartRecruiters, etc.) → not yet supported by this pipeline; flag it rather than force-fitting it into one of the three above.
3. Hand those value(s) over (a message, an issue, a line in a doc — however's convenient) in the form: `{platform: "greenhouse"|"lever"|"workday", company: "Display Name", slug: "..."}` (Greenhouse/Lever) or `{platform: "workday", company: "Display Name", tenant: "...", dc: "...", site: "..."}` (Workday).
4. That gets added as one entry to `COMPANY_BOARDS` or `WORKDAY_BOARDS` in `scripts/ingest-jobs.js`.
5. Verified with a real, live run — either `node scripts/ingest-jobs.js` from a machine with normal internet access, or by triggering `.github/workflows/ingest-jobs.yml` in GitHub Actions and reading its log for that source's line (`Company: fetched N postings` = confirmed; `FAILED (HTTP ...)` = the value(s) were wrong, try again from step 2).
6. Once confirmed live, it's permanent — every scheduled daily run picks it up automatically from then on, same as the currently-confirmed 10 Greenhouse companies.

This is the same process that already produced the 10 Greenhouse entries
currently live (Stripe, Airbnb, Coinbase, Robinhood, Figma, Asana,
GitLab, Affirm, Instacart, Pinterest) — it just hasn't been run yet for
any bank, consulting firm, or non-tech corporate, because doing so needs
a real URL from a real browser session, which is the one piece this
pipeline can't do for itself. Worth naming as a real gap rather than
routing around it: strategy-consulting and banking employers overwhelmingly
run Workday or a custom portal, not Greenhouse/Lever, so closing that
specific gap depends on steps 1-3 happening for those employers
specifically, not on adding more tech-company entries.

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
