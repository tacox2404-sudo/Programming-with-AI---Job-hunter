#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * Job ingestion pipeline — the "continuous update" half of the system
 * (the profile side's repeatable piece is the Import button in the
 * Profile Builder; see PROTOCOL.md for both).
 *
 * Pulls postings from a handful of free, keyless public job-board APIs,
 * classifies each into our controlled vocabularies (taxonomies.js),
 * dedupes against whatever's already in data/jobs.json by a stable id,
 * and merges the result back in — so running this repeatedly appends
 * and refreshes rather than replacing the dataset.
 *
 * IMPORTANT: this cannot run inside a network-restricted Claude Code
 * session — outbound access to these domains is blocked by org policy
 * there (confirmed: every one of these sources returned a proxy 403
 * when tested from that environment). It's meant to run in CI (see
 * .github/workflows/ingest-jobs.yml, scheduled) or on any machine with
 * normal internet access:
 *
 *   node scripts/ingest-jobs.js
 *
 * Run `node scripts/ingest-jobs.js --test` to exercise the classify /
 * dedupe / merge logic against local fixtures instead — zero network
 * calls, zero writes to the real data file. That's the "validate the
 * structure before depending on something live" step for this piece.
 * ------------------------------------------------------------------- */

const fs = require("fs");
const path = require("path");
const { classifyRoleFamily, classifySeniority, NON_PROFESSIONAL_TITLE_HINTS } = require("../taxonomies.js");

const DATA_PATH = path.join(__dirname, "..", "data", "jobs.json");
const COMPANIES_REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "registry", "companies.json"), "utf8"));
const LOCATIONS_REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "registry", "locations.json"), "utf8"));

/* Exact-match only (case-insensitive) — no fuzzy matching here, unlike
   the profile side's registry.js. A wrong fuzzy match silently mislabels
   a real posting's industry; an exact-match miss just leaves it blank,
   which is the honest outcome when ingestion can't verify something. */
/* A few entries carry a small `aliases` array (a brand/practice name
   too different from the parent's legal name for fuzzy matching to
   bridge, e.g. "FTI Delta" -> FTI Consulting) — indexed here under the
   same industry as their parent so an exact lookup on either resolves. */
const companyIndustryByName = new Map();
COMPANIES_REGISTRY.filter(c => c.industry).forEach(c => {
  companyIndustryByName.set(c.name.toLowerCase(), c.industry);
  (c.aliases || []).forEach(a => companyIndustryByName.set(a.toLowerCase(), c.industry));
});
/* A much broader signal than company_industry above: TRUE for any
   company in the registry at all, including the ~2,982 NASDAQ-listing
   entries with no GICS sector attached. Industry coverage is under 2%
   of real postings, but "is this a real, recognizable company" is a
   much bigger set — this is what a "verified companies" filter on the
   job board actually uses, since most registry matches don't have an
   industry to show. */
const verifiedCompanyNames = new Set();
COMPANIES_REGISTRY.forEach(c => {
  verifiedCompanyNames.add(c.name.toLowerCase());
  (c.aliases || []).forEach(a => verifiedCompanyNames.add(a.toLowerCase()));
});
function isVerifiedCompany(name) { return verifiedCompanyNames.has((name || "").toLowerCase()); }
const locationByCity = new Map(LOCATIONS_REGISTRY.map(l => [l.city.toLowerCase(), l]));

/* Arbeitnow (the largest free source) is Germany-heavy and gives raw
   German city names; our locations registry uses English exonyms
   throughout, so a handful of the common mismatches need translating
   before the lookup above can find them. Small and explicit on purpose
   — anything not in this list just falls through to the raw string. */
const GERMAN_CITY_TRANSLATIONS = {
  "münchen": "Munich", "koeln": "Cologne", "köln": "Cologne", "hannover": "Hanover",
  "nürnberg": "Nuremberg", "wien": "Vienna", "mailand": "Milan", "rom": "Rome",
  "genf": "Geneva", "warschau": "Warsaw", "prag": "Prague", "kopenhagen": "Copenhagen"
};

/* Best-effort: the first comma-segment of a raw location string is
   usually the city (the rest is state/region/country, often in German
   — "Frankfurt am Main, Hessen, Deutschland"). Translated if it's a
   known German exonym, then matched against the curated locations
   registry; the canonical "City, Country" form is used only on a
   match, otherwise the (still useful, just unverified) raw city name
   is kept as-is rather than discarded. */
function canonicalizeLocation(raw, isRemote) {
  if (isRemote) return "Remote";
  const first = (raw || "").split(",")[0].trim();
  if (!first) return "";
  if (/^remote$|^worldwide$/i.test(first)) return "Remote";
  const translated = GERMAN_CITY_TRANSLATIONS[first.toLowerCase()] || first;
  const match = locationByCity.get(translated.toLowerCase());
  return match ? match.display : translated;
}

function isNonProfessionalTitle(title) {
  const t = (title || "").toLowerCase();
  return NON_PROFESSIONAL_TITLE_HINTS.some(hint => t.includes(hint));
}

function mapEmploymentType(raw) {
  const t = (raw || "").toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("part")) return "Part-time";
  if (t.includes("contract") || t.includes("freelance")) return "Contract";
  if (t.includes("full")) return "Full-time";
  return "";
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* Each source: fetch its own URL, pull the array of raw postings out of
   the response body, and map ONE raw posting to our intermediate shape.
   Fields a source doesn't actually provide are left "" / [] here —
   normalize() below turns that into the final record and never invents
   a value a source didn't give it. */
const SOURCES = [
  {
    name: "Remotive",
    url: "https://remotive.com/api/remote-jobs?limit=200",
    extract: body => JSON.parse(body).jobs || [],
    map: item => ({
      external_id: `remotive:${item.id}`,
      title: item.title || "",
      company: item.company_name || "",
      location_city: "Remote",
      work_mode: "Remote",
      employment_type: mapEmploymentType(item.job_type),
      required_skills: (item.tags || []).slice(0, 8),
      posted_date: (item.publication_date || "").slice(0, 10),
      source_url: item.url || "",
      description: stripHtml(item.description).slice(0, 400)
    })
  },
  {
    name: "Arbeitnow",
    url: "https://www.arbeitnow.com/api/job-board-api",
    extract: body => JSON.parse(body).data || [],
    map: item => ({
      external_id: `arbeitnow:${item.slug}`,
      title: item.title || "",
      company: item.company_name || "",
      location_city: item.remote ? "Remote" : (item.location || ""),
      work_mode: item.remote ? "Remote" : "",
      employment_type: mapEmploymentType((item.job_types || [])[0]),
      required_skills: (item.tags || []).slice(0, 8),
      posted_date: item.created_at ? new Date(item.created_at * 1000).toISOString().slice(0, 10) : "",
      source_url: item.url || "",
      description: stripHtml(item.description).slice(0, 400)
    })
  },
  {
    name: "TheMuse",
    url: "https://www.themuse.com/api/public/jobs?page=0",
    extract: body => JSON.parse(body).results || [],
    map: item => ({
      external_id: `themuse:${item.id}`,
      title: item.name || "",
      company: (item.company || {}).name || "",
      location_city: ((item.locations || [])[0] || {}).name || "",
      work_mode: "",
      employment_type: mapEmploymentType(item.type),
      required_skills: (item.categories || []).map(c => c.name).slice(0, 8),
      posted_date: (item.publication_date || "").slice(0, 10),
      source_url: (item.refs || {}).landing_page || "",
      description: stripHtml(item.contents).slice(0, 400)
    })
  }
];

/* Greenhouse and Lever are real, public, documented job-board APIs a
   lot of companies use as their applicant tracking system directly —
   not scraping, no ToS ambiguity, no HTML parsing to break when a
   career page redesigns. The catch: coverage is entirely dependent on
   whether a given company happens to use one of these two platforms.
   Large consulting/finance firms mostly run their own custom career
   portals (Workday, SuccessFactors, homegrown) instead, so this list
   currently skews tech/startup — that's a real, honest limit, not
   something more entries here fixes.

   Every entry below is LIVE-VERIFIED: confirmed via a real CI run
   returning postings, not a guess (see the 2026-09-17 run for the
   ones that turned out wrong: DoorDash and Notion on Greenhouse, and
   all of Netflix/Box/Plaid on Lever, 404'd — pulled from this list
   rather than left in as dead weight). A wrong/outdated slug 404s and
   is skipped cleanly, same as any other source failing, so a new
   guess here is low-risk to try — but "confirmed" in this list
   specifically means "has produced real postings in a real run," not
   "should work." See PROTOCOL.md's "Per-company coverage plan" for
   the exact steps to verify a new one before adding it. */
const COMPANY_BOARDS = [
  { platform: "greenhouse", slug: "stripe", company: "Stripe" },
  { platform: "greenhouse", slug: "airbnb", company: "Airbnb" },
  { platform: "greenhouse", slug: "coinbase", company: "Coinbase" },
  { platform: "greenhouse", slug: "robinhood", company: "Robinhood" },
  { platform: "greenhouse", slug: "figma", company: "Figma" },
  { platform: "greenhouse", slug: "asana", company: "Asana" },
  { platform: "greenhouse", slug: "gitlab", company: "GitLab" },
  { platform: "greenhouse", slug: "affirm", company: "Affirm" },
  { platform: "greenhouse", slug: "instacart", company: "Instacart" },
  { platform: "greenhouse", slug: "pinterest", company: "Pinterest" }
  /* No live-verified Lever slug yet — the three seeded guesses
     (Netflix, Box, Plaid) all 404'd. leverSource() itself is still
     tested via fixture below; it just has nothing real to point at
     until a confirmed slug turns up. */
];

function greenhouseSource(entry) {
  return {
    name: `Greenhouse:${entry.company}`,
    url: `https://boards-api.greenhouse.io/v1/boards/${entry.slug}/jobs?content=true`,
    extract: body => JSON.parse(body).jobs || [],
    map: item => ({
      external_id: `greenhouse:${entry.slug}:${item.id}`,
      title: item.title || "",
      company: entry.company,
      location_city: (item.location || {}).name || "",
      work_mode: /remote/i.test((item.location || {}).name || "") ? "Remote" : "",
      employment_type: "",
      required_skills: [],
      posted_date: (item.updated_at || "").slice(0, 10),
      source_url: item.absolute_url || "",
      description: stripHtml(item.content || "").slice(0, 400)
    })
  };
}

function leverSource(entry) {
  return {
    name: `Lever:${entry.company}`,
    url: `https://api.lever.co/v0/postings/${entry.slug}?mode=json`,
    extract: body => JSON.parse(body) || [],
    map: item => ({
      external_id: `lever:${entry.slug}:${item.id}`,
      title: item.text || "",
      company: entry.company,
      location_city: (item.categories || {}).location || "",
      work_mode: /remote/i.test((item.categories || {}).location || "") ? "Remote" : "",
      employment_type: mapEmploymentType((item.categories || {}).commitment || ""),
      required_skills: [],
      posted_date: item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "",
      source_url: item.hostedUrl || "",
      description: stripHtml(item.descriptionPlain || item.description || "").slice(0, 400)
    })
  };
}

COMPANY_BOARDS.forEach(entry => {
  SOURCES.push(entry.platform === "greenhouse" ? greenhouseSource(entry) : leverSource(entry));
});

/* Workday is the dominant enterprise ATS for large banks, consulting
   firms, and Fortune-500-scale corporates — exactly the "major banks
   and advisories... strategy consulting... huge corporates" target,
   which Greenhouse/Lever above structurally can't reach (those skew
   tech/startup). A Workday career site's own search box calls a JSON
   endpoint at /wday/cxs/{tenant}/{site}/jobs — publicly reachable, no
   login, the exact same data any visitor sees on the page, just
   fetched directly instead of through the rendered page. Worth being
   precise about what this is NOT: unlike Greenhouse/Lever, Workday
   doesn't publish this as a documented third-party API with its own
   terms — it's the site's own frontend data endpoint. Read-only,
   no auth bypass, nothing scraped from rendered HTML.

   The hard part: three per-company unknowns (the tenant slug, the
   data-center prefix — wd1/wd3/wd5/wd12 are all common, no way to
   guess reliably, and the "site" path, which varies by company with
   no fixed convention). The reliable way to add a specific company:
   visit its real careers page, let it redirect to
   *.myworkdayjobs.com/en-US/<site>/..., and read tenant/dc/site
   straight out of that URL — see PROTOCOL.md's "Per-company coverage
   plan" for the full step-by-step.

   This list starts EMPTY on purpose. The first version seeded 7
   best-effort guesses (Bank of America, Charles Schwab, Visa,
   Mastercard, PepsiCo, Nike, GE) from general knowledge rather than a
   real careers-page URL — a live CI run on 2026-09-17 confirmed all 7
   wrong (401/404/422, one per company, no pattern to learn from).
   Guessing tenant+dc+site right by chance is close enough to zero
   that seeding more guesses isn't a real coverage strategy; getting
   this list populated needs someone to actually visit each target
   company's careers page once. workdaySource() and the date-parsing
   logic are still tested via fixture below — they're ready the moment
   a real, confirmed entry is added. */
const WORKDAY_BOARDS = [];

/* Workday's list endpoint gives a relative string ("Posted 3 Days
   Ago", "Posted Today", "Posted 30+ Days Ago") instead of a real
   date. "X Days Ago" and "Today" resolve to a real calendar date by
   subtracting from now — that's arithmetic, not a guess. "30+ Days
   Ago" is a range with no single correct point in it, so it's left
   blank rather than picking an arbitrary day inside that range. */
function parseWorkdayRelativeDate(text) {
  const t = (text || "").toLowerCase();
  if (/today/.test(t)) return new Date().toISOString().slice(0, 10);
  const m = /(\d+)\s*\+?\s*day/.exec(t);
  if (m && !t.includes("+")) {
    const d = new Date();
    d.setDate(d.getDate() - parseInt(m[1], 10));
    return d.toISOString().slice(0, 10);
  }
  return "";
}

function workdaySource(entry) {
  const base = `https://${entry.tenant}.${entry.dc}.myworkdayjobs.com`;
  return {
    name: `Workday:${entry.company}`,
    url: `${base}/wday/cxs/${entry.tenant}/${entry.site}/jobs`,
    method: "POST",
    body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: "" }),
    extract: body => JSON.parse(body).jobPostings || [],
    map: item => ({
      external_id: `workday:${entry.tenant}:${(item.bulletFields || [])[0] || item.externalPath}`,
      title: item.title || "",
      company: entry.company,
      // The list endpoint doesn't include a full description (only
      // the per-posting detail page does) — left blank rather than
      // fetching N detail pages per company, which for a company with
      // hundreds of postings would multiply the request count hugely.
      location_city: item.locationsText || "",
      work_mode: /remote/i.test(item.locationsText || "") ? "Remote" : "",
      employment_type: "",
      required_skills: [],
      posted_date: parseWorkdayRelativeDate(item.postedOn),
      source_url: base + (item.externalPath || ""),
      description: ""
    })
  };
}

WORKDAY_BOARDS.forEach(entry => SOURCES.push(workdaySource(entry)));

/* Salary is still left unset — none of these free sources reliably
   provide structured pay data, and bucketing a guess from free text
   is exactly the fabrication this project avoids elsewhere. Industry
   and location, though, are now looked up against the real registries
   (data/registry/*.json) rather than left blank across the board:
   company_industry only fills in on an exact, case-insensitive company
   name match (a miss stays "" — never guessed from the name), and
   location_city is canonicalized through the curated locations list
   with a small German-exonym translation step first. */
function normalize(source, raw) {
  const mapped = source.map(raw);
  if (!mapped.title || !mapped.company) return null;
  if (isNonProfessionalTitle(mapped.title)) return null;
  return {
    id: mapped.external_id,
    title: mapped.title,
    company: mapped.company,
    company_industry: companyIndustryByName.get(mapped.company.toLowerCase()) || "",
    company_verified: isVerifiedCompany(mapped.company),
    role_family: classifyRoleFamily(mapped.title),
    seniority: classifySeniority(mapped.title),
    employment_type: mapped.employment_type || "",
    location_city: canonicalizeLocation(mapped.location_city, mapped.work_mode === "Remote"),
    work_mode: mapped.work_mode || "",
    pay_bracket: "",
    currency: "",
    visa_sponsorship: null, // unknown — never conflated with "no" (see jobs.js dealbreaker check)
    required_skills: mapped.required_skills || [],
    posted_date: mapped.posted_date || "",
    description: mapped.description || "",
    source: source.name,
    source_url: mapped.source_url || "",
    ingested_at: new Date().toISOString()
  };
}

async function fetchSource(source) {
  const init = { headers: { "User-Agent": "job-hunter-poc/1.0" } };
  if (source.method === "POST") {
    init.method = "POST";
    init.headers["Content-Type"] = "application/json";
    init.body = source.body;
  }
  const res = await fetch(source.url, init);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return source.extract(await res.text());
}

function loadExisting() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); }
  catch (e) { return []; }
}

/* Merging by stable id is what makes repeated runs additive instead of
   replacing the file: an already-known posting gets its fields
   refreshed but keeps its original ingested_at, a new one gets added,
   and nothing already in the file (e.g. from a source that failed this
   run) is ever dropped just because this run didn't see it again. */
function mergeJobs(existing, incoming) {
  const byId = new Map(existing.map(j => [j.id, j]));
  let added = 0, updated = 0;
  incoming.forEach(job => {
    if (!job) return;
    const prev = byId.get(job.id);
    if (!prev) { byId.set(job.id, job); added++; }
    else { byId.set(job.id, Object.assign({}, job, { ingested_at: prev.ingested_at, last_seen_at: new Date().toISOString() })); updated++; }
  });
  const merged = Array.from(byId.values()).sort((a, b) => (b.posted_date || "").localeCompare(a.posted_date || ""));
  return { merged, added, updated };
}

/* "Append, never replace" (mergeJobs above) means a bad posting written
   by an OLDER version of normalize() would otherwise sit in the file
   forever — a classification fix only applies to postings fetched after
   the fix ships. This re-derives the same fields from what's already on
   disk (no network call needed, the title/company/location are already
   stored) and drops anything that now fails the non-professional filter,
   so every run also cleans up after its own past runs, not just itself. */
function reclassifyExisting(job) {
  if (isNonProfessionalTitle(job.title)) return null;
  return Object.assign({}, job, {
    role_family: classifyRoleFamily(job.title),
    seniority: classifySeniority(job.title),
    company_industry: companyIndustryByName.get((job.company || "").toLowerCase()) || job.company_industry || "",
    company_verified: isVerifiedCompany(job.company),
    location_city: canonicalizeLocation(job.location_city, job.work_mode === "Remote")
  });
}

/* None of these free sources give a real closing/expiry date — only
   posted_date. Re-checking whether an old posting is still live would
   mean re-fetching and diffing against the source, which we already do
   every run anyway (a posting that's gone just won't be in `results`
   again). What we DON'T do today is ever remove a posting that stops
   reappearing — it just sits there, undated as far as the user can
   tell, forever. EXPIRY_DAYS is a blunt but honest stand-in: a
   professional-role posting older than this is more likely filled or
   withdrawn than still open, so it's dropped outright rather than kept
   and re-verified (which we have no way to actually do). */
const EXPIRY_DAYS = 45;
function isExpired(job) {
  if (!job.posted_date) return false; // unknown age — don't guess, don't drop
  const posted = new Date(job.posted_date);
  if (isNaN(posted.getTime())) return false;
  const ageDays = (Date.now() - posted.getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > EXPIRY_DAYS;
}

async function runLive() {
  const results = [];
  for (const source of SOURCES) {
    try {
      const raw = await fetchSource(source);
      let excluded = 0;
      raw.forEach(item => {
        const n = normalize(source, item);
        if (n) results.push(n); else excluded++;
      });
      console.log(`${source.name}: fetched ${raw.length} postings, ${excluded} excluded (non-professional or missing title/company)`);
    } catch (e) {
      console.error(`${source.name}: FAILED (${e.message}) — skipping this source, continuing with the rest.`);
    }
  }
  const rawExisting = loadExisting();
  const reclassified = rawExisting.map(reclassifyExisting).filter(Boolean);
  const nonProfessionalDropped = rawExisting.length - reclassified.length;
  const existing = reclassified.filter(j => !isExpired(j));
  const expiredDropped = reclassified.length - existing.length;
  const freshResults = results.filter(j => !isExpired(j));
  const { merged, added, updated } = mergeJobs(existing, freshResults);
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`Reclassified ${reclassified.length} existing postings against current rules (${nonProfessionalDropped} dropped as non-professional, ${expiredDropped} dropped as older than ${EXPIRY_DAYS} days).`);
  console.log(`data/jobs.json: ${added} new, ${updated} refreshed, ${merged.length} total.`);
}

function runTest() {
  const fixtures = require("./fixtures/sample-api-responses.js");
  /* Test coverage for a platform's field-mapping logic (leverSource,
     workdaySource) is deliberately independent of whether COMPANY_BOARDS
     / WORKDAY_BOARDS currently has a live-verified entry for that
     platform — a mapping function shouldn't go untested just because
     every guessed slug for it 404'd. These two are fixture-only test
     sources; add a live-verified entry to the boards above once one
     is confirmed, and it'll pick up automatically without needing a
     test change. */
  const testOnlySources = [
    leverSource({ slug: "netflix", company: "Netflix" }),
    workdaySource({ tenant: "bofa", dc: "wd1", site: "Global", company: "Bank of America" })
  ];
  const testSources = SOURCES.concat(testOnlySources);
  const results = [];
  testSources.forEach(source => {
    (fixtures[source.name] || []).forEach(item => {
      const n = normalize(source, item);
      if (n) results.push(n);
    });
  });
  console.log(`[test] normalized ${results.length} fixture postings from ${testSources.length} sources (no network, no disk writes):`);
  results.forEach(r => console.log(`  - "${r.title}" @ ${r.company} -> role_family="${r.role_family || "(unclassified)"}" seniority="${r.seniority || "(unclassified)"}" industry="${r.company_industry || "(none)"}" location="${r.location_city || "(none)"}"`));

  const threeDaysAgo = new Date(); threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const registryChecks = [
    [results.length === 9, "expected 9 normalized postings (10 fixtures minus 1 excluded apprenticeship)"],
    [!results.some(r => /ausbildung/i.test(r.title)), "the apprenticeship fixture must be excluded, not just unclassified"],
    [(results.find(r => r.company === "3M") || {}).company_industry === "Industrials", "3M should get its real S&P 500 GICS sector (Industrials) from the registry"],
    [(results.find(r => r.company === "3M") || {}).location_city === "Munich, Germany", "'München' should canonicalize to 'Munich, Germany' via the locations registry"],
    [companyIndustryByName.get("pwc") === "Consulting", "curated professional-services firms (PwC) should classify as Consulting, not GICS Industrials"],
    [companyIndustryByName.get("fti delta") === "Consulting", "a registry alias (FTI Delta -> FTI Consulting) should resolve to the parent's industry"],
    [(results.find(r => r.company === "3M") || {}).company_verified === true, "3M (a real registry company) should be flagged company_verified"],
    [(results.find(r => r.company === "Fixture Corp") || {}).company_verified === false, "a made-up fixture company should NOT be flagged company_verified"],
    [(results.find(r => r.company === "Stripe") || {}).source === "Greenhouse:Stripe", "Greenhouse fixture should normalize with the company name injected (the API itself doesn't provide one)"],
    [(results.find(r => r.company === "Stripe") || {}).location_city === "Remote", "Greenhouse location.name (\"Remote - US\") should canonicalize to \"Remote\" like any other remote posting"],
    [(results.find(r => r.company === "Netflix") || {}).employment_type === "Full-time", "Lever categories.commitment should map through mapEmploymentType"],
    [(results.find(r => r.company === "Netflix") || {}).posted_date === "2027-01-01", "Lever createdAt (epoch ms) should convert to YYYY-MM-DD"],
    [(results.find(r => r.title === "Investment Banking Analyst") || {}).company === "Bank of America", "Workday fixture should normalize with the company name injected"],
    [(results.find(r => r.title === "Investment Banking Analyst") || {}).posted_date === threeDaysAgo.toISOString().slice(0, 10), "Workday's relative 'Posted 3 Days Ago' should resolve to an actual date, not be left as text"],
    [(results.find(r => r.title === "Posted 30+ days old fixture") || {}).posted_date === "", "Workday's '30+ Days Ago' is a range, not a point — must stay blank, not guessed"]
  ];
  const registryFailed = registryChecks.filter(([ok]) => !ok);
  registryFailed.forEach(([, msg]) => console.error("[test] FAIL — " + msg));
  console.log(registryFailed.length ? `[test] ${registryFailed.length} registry check(s) failed.` : "[test] PASS — professional-role filter, company_industry lookup, and location canonicalization all correct.");
  if (registryFailed.length) process.exitCode = 1;

  if (!results.length) { console.error("[test] FAIL — no fixtures normalized"); process.exitCode = 1; return; }

  const existingFixture = [Object.assign({}, results[0], { ingested_at: "2020-01-01T00:00:00.000Z" })];
  const { merged, added, updated } = mergeJobs(existingFixture, results);
  console.log(`[test] merge check: existing=${existingFixture.length}, incoming=${results.length} -> added=${added}, updated=${updated}, total=${merged.length}`);

  const checks = [
    [merged.length === results.length, "merge total should equal distinct incoming postings"],
    [updated === 1 && added === results.length - 1, "exactly the pre-existing posting should be 'updated', the rest 'added'"],
    [(merged.find(j => j.id === existingFixture[0].id) || {}).ingested_at === "2020-01-01T00:00:00.000Z", "re-ingesting an existing posting must preserve its original ingested_at"]
  ];
  const failed = checks.filter(([ok]) => !ok);
  failed.forEach(([, msg]) => console.error("[test] FAIL — " + msg));
  console.log(failed.length ? `[test] ${failed.length} check(s) failed.` : "[test] PASS — all checks passed.");
  if (failed.length) process.exitCode = 1;

  const staleGoodPosting = Object.assign({}, results[0], { role_family: "", seniority: "", company_industry: "" });
  const staleBadPosting = Object.assign({}, results[0], { id: "stale:ausbildung", title: "Ausbildung zum Fachinformatiker (m/w/d)" });
  const reclassified = [staleGoodPosting, staleBadPosting].map(reclassifyExisting);
  const reclassifyChecks = [
    [reclassified[0] !== null && reclassified[0].role_family === results[0].role_family, "reclassifyExisting should re-derive role_family for a stale posting missing it"],
    [reclassified[1] === null, "reclassifyExisting must drop a stale posting that now fails the non-professional filter, even though it was saved before the filter existed"]
  ];
  const reclassifyFailed = reclassifyChecks.filter(([ok]) => !ok);
  reclassifyFailed.forEach(([, msg]) => console.error("[test] FAIL — " + msg));
  console.log(reclassifyFailed.length ? `[test] ${reclassifyFailed.length} reclassify check(s) failed.` : "[test] PASS — reclassifyExisting refreshes and retroactively cleans stale postings.");
  if (reclassifyFailed.length) process.exitCode = 1;

  const oldPosting = Object.assign({}, results[0], { posted_date: "2020-01-01" });
  const freshPosting = Object.assign({}, results[0], { posted_date: new Date().toISOString().slice(0, 10) });
  const undatedPosting = Object.assign({}, results[0], { posted_date: "" });
  const expiryChecks = [
    [isExpired(oldPosting) === true, "a posting far older than EXPIRY_DAYS must be treated as expired"],
    [isExpired(freshPosting) === false, "a posting from today must not be treated as expired"],
    [isExpired(undatedPosting) === false, "a posting with no posted_date must not be guessed as expired — unknown stays unknown"]
  ];
  const expiryFailed = expiryChecks.filter(([ok]) => !ok);
  expiryFailed.forEach(([, msg]) => console.error("[test] FAIL — " + msg));
  console.log(expiryFailed.length ? `[test] ${expiryFailed.length} expiry check(s) failed.` : "[test] PASS — expired postings are dropped outright, not re-verified.");
  if (expiryFailed.length) process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes("--test")) runTest();
else runLive().catch(err => { console.error("Ingestion failed:", err); process.exitCode = 1; });
