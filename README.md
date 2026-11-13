# Job Search Profile Builder + Job Board

A prototype, not a live product yet: two independent, plain HTML/CSS/JS tools —
a structured candidate profile builder, and a job board backed by a real,
scheduled ingestion pipeline. No backend, no build step, no framework. Each
runs entirely in the browser off `localStorage` and static JSON files.

The two systems are deliberately kept apart. A profile update never depends on
job ingestion having run, and job ingestion never depends on any one user's
profile existing. Matching between them exists as an optional, toggleable
extra on the job board — off by default behavior is identical to having no
matching feature at all. See [PROTOCOL.md](PROTOCOL.md) for the full reasoning
and both pipelines in detail.

## Running it locally

Both pages fetch JSON at runtime (`fetch("data/...")`), which browsers block
under `file://` — you need a static server, not just opening the HTML file:

```
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html` (Profile Builder) or
`http://localhost:8000/jobs.html` (Job Board). Any static server works —
`npx serve`, VS Code's Live Server, etc.

### Trying it with your own data

If you have a [base44](https://base44.app) "career-profile-craft" export,
convert it to this tool's schema and import it instead of typing everything by
hand:

```
node scripts/convert-base44-profile.js your-export.json converted.json
```

Prints a report of anything it mapped, dropped, or left blank rather than
guessed — then open `index.html`, click **Import profile.json**, and pick
`converted.json`. See the script's own header comment for what it fixes up
versus what base44 exports (duplicate skills, spoken vs. programming languages
sharing one category, flattened certifications, a broken cascading
preferences array).

## What's here

```
index.html, app.js          Profile Builder — structured fields, CV-paste
                             suggestions, Documents (cover letters etc.),
                             export/import profile.json
jobs.html, jobs.js           Job Board — filters, search, optional matching
                             against a saved profile
taxonomies.js                Single source of truth for every enum/controlled
                             vocabulary used by both pages and the scripts
registry.js                  Loads the real reference datasets below + the
                             fuzzy-match used against them (browser only)
style.css                    Shared stylesheet

data/jobs.json                Live dataset — output of the ingestion pipeline,
                               never hand-edited
data/jobs.seed.json           18 hand-authored sample postings, used as a
                               fallback before jobs.json exists
data/registry/universities.json   10,240 real universities (name + country)
data/registry/companies.json      3,578 real companies, GICS sector where
                                   verifiable (S&P 500 + curated + NASDAQ
                                   listings), tagged with a `source` field so
                                   confidence is never overstated
data/registry/locations.json      128 curated locations (US / EU focus / Dubai),
                                   canonical English spelling

scripts/ingest-jobs.js        Scheduled job-posting pipeline (see PROTOCOL.md)
scripts/convert-base44-profile.js   base44 export -> this tool's profile.json
scripts/fixtures/             Fixture data for ingest-jobs.js --test

.github/workflows/ingest-jobs.yml   Runs the ingestion pipeline daily

tests/                        Logic tests — see below
PROTOCOL.md                   The two pipelines, in depth, including the
                               network-access limitation inside a Claude Code
                               session specifically
```

## Tests

Zero-dependency Node scripts, same convention as `ingest-jobs.js --test` —
each one `require()`s the real app code (via a small CommonJS export shim
guarded by `typeof module`, so the same file still works as a plain browser
`<script>`) and asserts against it. No DOM, no browser automation, no
`npm install` — that's a deliberate match to the rest of the project staying
dependency-free; it also means these don't cover rendering or click-through
behavior, only the underlying logic.

```
node tests/run-all.js               # everything
node tests/jobs-matching.test.js    # match-scoring + dealbreaker rules
node tests/convert-base44-profile.test.js   # base44 converter
node scripts/ingest-jobs.js --test  # ingestion classify/dedupe/merge
```

## Current limits

- **No deployment** — this runs locally only, by design at this stage. The
  architecture (static files, no server state) is deploy-ready whenever that's
  wanted.
- **No accounts** — every browser gets its own independent profile via
  `localStorage`. No sync across devices, no shared/admin view. See
  PROTOCOL.md for what that would actually take.
- **Company registry coverage is real but partial** — S&P 500 + a curated
  multinational list + NASDAQ listings, tagged by confidence. A student
  organization, a boutique firm, or most small/regional employers won't be in
  it; `company_industry` is left honestly blank rather than guessed in that
  case, both on the job board and in the base44 converter.
- **Ingested postings are unevenly classified** — role/seniority/location
  quality depends on the free source APIs actually feeding
  `scripts/ingest-jobs.js`. Coverage numbers and what's driving them are
  tracked as this evolves, not claimed as finished.
