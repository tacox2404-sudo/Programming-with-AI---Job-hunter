"use strict";

/* ---------------------------------------------------------------------
 * Controlled vocabularies for the profile. Every enum-backed field in
 * the app pulls its options from here and nowhere else, so a filter or
 * matcher built later only ever sees one of these fixed values — never
 * free text, never null/undefined (empty string is the "unset" value
 * throughout instead).
 *
 * The *_SEED lists (institutions, companies) are tiny emergency
 * fallbacks used only if the real registries fail to load — see
 * data/registry/*.json (10,240 real universities, 562 real companies
 * with real GICS sectors, 128 real curated locations) loaded async by
 * app.js/jobs.js. registry.js has the loader + the scale-appropriate
 * fuzzy-match used against the big lists.
 * ------------------------------------------------------------------- */

const INSTITUTION_TYPES = ["University", "College", "Bootcamp", "Online course / certification", "Vocational school", "High school", "Other"];
const DEGREE_TYPES = ["High school diploma", "Associate", "BSc", "MSc", "MBA", "PhD", "Professional certificate", "Bootcamp certificate", "Other"];
const GPA_SCALES = ["4.0", "5.0", "10.0", "20.0", "100", "N/A"];

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance", "Volunteer"];
const SENIORITY_LEVELS = ["Intern", "Entry-level", "Associate", "Mid-level", "Senior", "Lead", "Manager", "Director", "Executive"];

const SKILL_CATEGORIES = ["Technical", "Tool / software", "Language", "Domain knowledge", "Soft skill", "Certification"];
const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

const LANGUAGE_PROFICIENCY = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
const COMMON_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Mandarin", "Arabic", "Hindi", "Japanese", "Korean", "Dutch", "Russian"];

const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "Onsite", "Flexible / no preference"];
const JOB_SEARCH_STATUS = ["Actively looking", "Open to offers", "Not looking"];

/* The 11 GICS sectors (the real classification standard S&P/MSCI use —
   see data/registry/companies.json, whose industry field is drawn
   straight from it) plus four pragmatic additions for cases GICS
   structurally doesn't give a useful answer for: Education, Government,
   and Non-profit (GICS only classifies publicly traded companies), and
   Consulting. GICS technically files management/strategy consulting
   under Industrials -> Commercial & Professional Services, but showing
   PwC or McKinsey as "Industrials" reads as wrong to anyone looking at
   their own profile, even though it's the textbook-correct sector — so
   consulting/professional-services firms get their own value here
   instead, same as the other three practical carve-outs. One shared
   vocabulary for a profile's stated industry preference AND a job
   posting's company_industry — same list, same spelling, everywhere. */
const INDUSTRY_LIST = [
  "Communication Services", "Consumer Discretionary", "Consumer Staples", "Energy",
  "Financials", "Health Care", "Industrials", "Information Technology", "Materials",
  "Real Estate", "Utilities",
  "Consulting", "Education", "Government", "Non-profit"
];

const CITY_SUGGESTIONS = [
  "Remote", "New York, USA", "San Francisco, USA", "London, UK", "Berlin, Germany",
  "Amsterdam, Netherlands", "Paris, France", "Dublin, Ireland", "Toronto, Canada",
  "Singapore", "Sydney, Australia", "Madrid, Spain", "Lisbon, Portugal", "Barcelona, Spain",
  "Zurich, Switzerland", "Stockholm, Sweden", "Tokyo, Japan", "Dubai, UAE",
  "Bangalore, India", "São Paulo, Brazil"
];

const DEALBREAKER_PRESETS = [
  "No remote option at all", "Unpaid position", "Rotational / night shifts",
  "Commute over 1 hour", "No visa sponsorship", "Rigid 9-to-5 hours"
];

const PAY_BRACKETS = ["Under 25k", "25k–40k", "40k–55k", "55k–70k", "70k–90k", "90k–120k", "120k+"];
const CURRENCIES = ["USD", "EUR", "GBP", "Other"];
const PERIODS = ["year", "month", "hour"];
const WORK_AUTH_OPTIONS = ["Citizen / permanent resident", "Currently authorized (visa or permit)", "Would need sponsorship", "Not sure yet"];
const FLEXIBILITY_OPTIONS = ["Immediately", "Within 2 weeks", "Within 1 month", "After a specific date", "Fully flexible"];

const LEVELS = ["Internship", "Graduate scheme / trainee", "Entry-level", "Junior", "Associate", "Other"];

const DOCUMENT_TYPES = ["Cover letter", "Resume / CV variant", "Achievement bank", "Recommendation / reference note", "Other"];

/* Canonical role categories for job postings — deliberately coarser and
   Title-Case (vs. ROLE_KEYWORDS above, which is a lowercase substring-match
   list used only for scanning free-text CVs). Shared by the job board's
   filters and match scoring so a posting and a candidate's stated roles
   are always compared against the same fixed set of values. */
const ROLE_FAMILIES = [
  "Business analyst", "Software engineer", "Data analyst", "Data scientist",
  "Product manager", "Marketing", "Sales", "Financial analyst", "Accountant",
  "Consultant", "Designer", "Operations", "Project manager", "Customer success",
  "HR / Recruiting", "Research"
];

/* Keyword → canonical-category maps used only by the job ingestion
   script (scripts/ingest-jobs.js) to classify a raw posting's free-text
   title into our controlled vocabularies. Checked in list order, first
   match wins. A title that matches nothing is left "" rather than
   guessed — an unclassified posting is still shown, just not filterable
   on that axis, which is honest; a wrong guess would be worse. */
/* Expanded against 285 real ingested postings (see PROTOCOL.md) — the
   English-only v1 list classified 44% of real titles; German terms
   below (Arbeitnow, the largest free source, is EU/Germany-heavy) and
   a wider IT-engineering net account for most of what v1 missed. */
const ROLE_FAMILY_KEYWORDS = {
  "Business analyst": ["business analyst", "biz analyst"],
  "Software engineer": [
    "software engineer", "backend", "front end", "frontend", "full stack", "full-stack", "swe",
    "developer", "programmer", "cloud engineer", "devops", "site reliability", " sre ",
    "platform engineer", "infrastructure engineer", "system engineer", "systems engineer",
    "network engineer", "it engineer", "it-systemadministrator", "systemadministrator",
    "fachinformatiker"
  ],
  "Data scientist": ["data scientist", "machine learning engineer", "ml engineer"],
  "Data analyst": ["data analyst"],
  "Product manager": ["product manager", "product owner", "produktentwickler"],
  "Financial analyst": [
    "financial analyst", "finance analyst", "investment banking", "investment banker",
    "ib analyst", "corporate banking", "credit analyst", "equity research",
    "m&a analyst", "markets analyst", "trading analyst", "risk analyst", "treasury analyst",
    "portfolio analyst", "private equity", "asset management analyst"
  ],
  "Accountant": ["accountant", "accounting", "finanzbuchhalter", "buchhaltung", "steuerberater"],
  "Consultant": ["consultant", "consulting", "unternehmensberater", "berater"],
  "Project manager": ["project manager", "program manager", "delivery manager", "projektleiter", "projektleitung"],
  "Customer success": ["customer success", "customer support", "account manager"],
  "HR / Recruiting": [
    "recruiter", "human resources", "hr generalist", "talent acquisition", "hr administrator",
    "people & culture", "personalwesen", "personalreferent"
  ],
  "Research": ["research analyst", "researcher", "research scientist"],
  "Designer": ["designer", "ux ", "ui designer", "grafiker", "kommunikationsdesign"],
  "Operations": ["operations", "ops analyst", "ops manager"],
  "Marketing": ["marketing", "social media manager", "content creator", "growth manager"],
  "Sales": ["sales", "account executive", "business development"]
};

/* Postings whose title matches one of these are dropped entirely
   during ingestion (see scripts/ingest-jobs.js) — vocational
   apprenticeships and casual/blue-collar shift work, not the
   professional roles this project targets. Deliberately narrow: only
   unambiguous terms, so a real professional posting is never
   silently dropped on a guess. */
const NON_PROFESSIONAL_TITLE_HINTS = [
  "ausbildung", "ausbilung", "minijob", "aushilfe", "lagerarbeiter", "reinigungskraft",
  "reinigung", "kellner", "servicekraft", "bäcker", "koch/köchin", "fahrer (m/w/d)",
  "lkw-fahrer", "quereinsteiger als", "handwerker"
];

const SENIORITY_KEYWORDS = {
  "Intern": ["intern", "internship", "working student", "trainee"],
  "Entry-level": ["entry level", "entry-level", "junior", "graduate", "new grad"],
  "Senior": ["senior", "sr."],
  "Lead": ["lead", "principal"],
  "Director": ["director"],
  "Executive": ["vp", "vice president", "chief ", "head of", "executive"],
  "Manager": ["manager"],
  "Associate": ["associate"],
  "Mid-level": ["mid level", "mid-level"]
};

function classifyRoleFamily(title) {
  const t = (title || "").toLowerCase();
  return ROLE_FAMILIES.find(family => (ROLE_FAMILY_KEYWORDS[family] || []).some(k => t.includes(k))) || "";
}

function classifySeniority(title) {
  const t = (title || "").toLowerCase();
  return SENIORITY_LEVELS.find(level => (SENIORITY_KEYWORDS[level] || []).some(k => t.includes(k))) || "";
}

const ROLE_KEYWORDS = [
  "software engineer", "data analyst", "data scientist", "product manager",
  "marketing", "sales", "business analyst", "financial analyst", "accountant",
  "designer", "ux designer", "consultant", "operations", "project manager",
  "customer success", "hr", "human resources", "recruiter", "researcher",
  "teacher", "nurse", "engineer", "developer", "analyst"
];

/* Small seed lists so the normalize-against-canonical demo has something
   to match against. Not remotely exhaustive — a real system would use a
   proper institution/company registry (see PR notes). */
const INSTITUTION_SEED = [
  "Università Bocconi", "Harvard University", "Stanford University", "MIT",
  "University of Oxford", "University of Cambridge", "ETH Zurich",
  "London School of Economics", "Sciences Po", "Politecnico di Milano",
  "University of Toronto", "National University of Singapore", "TU Munich"
];
const COMPANY_SEED = [
  "Google", "Microsoft", "Amazon", "Meta", "Apple", "McKinsey & Company",
  "Goldman Sachs", "JPMorgan Chase", "Deloitte", "PwC", "EY", "KPMG",
  "Accenture", "IBM", "Salesforce", "Spotify", "Stripe"
];

/* ---------------------------------------------------------------------
 * Normalization: cheap fuzzy match against a canonical list. This is a
 * deterministic string-distance stand-in for what would ideally be a
 * real registry/AI lookup — good enough to catch "Bocconi Univ." →
 * "Università Bocconi" or a dropped/extra letter, not a substitute for
 * an actual company/institution database.
 * ------------------------------------------------------------------- */

function levenshtein(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/* Returns { canonical, matched } — matched is true only when confident
   enough to auto-correct; otherwise canonical === the original input,
   unchanged, so we never invent a name the user didn't type. */
function normalizeAgainstList(input, canonicalList) {
  const trimmed = (input || "").trim();
  if (!trimmed) return { canonical: "", matched: false };
  const lower = trimmed.toLowerCase();
  const exact = canonicalList.find(c => c.toLowerCase() === lower);
  if (exact) return { canonical: exact, matched: true };

  let best = null, bestDist = Infinity;
  canonicalList.forEach(c => {
    const d = levenshtein(trimmed, c);
    if (d < bestDist) { bestDist = d; best = c; }
  });
  const threshold = Math.max(2, Math.round(trimmed.length * 0.3));
  if (best && bestDist <= threshold) return { canonical: best, matched: true };
  return { canonical: trimmed, matched: false };
}

/* ---------------------------------------------------------------------
 * Computed signals
 * ------------------------------------------------------------------- */

function monthsBetween(start, end) {
  // start/end are "YYYY-MM" strings; treat missing/invalid as 0-length.
  const parse = s => {
    const m = /^(\d{4})-(\d{2})$/.exec(s || "");
    return m ? parseInt(m[1], 10) * 12 + parseInt(m[2], 10) : null;
  };
  const s = parse(start);
  const e = end === "present" ? parse(new Date().toISOString().slice(0, 7)) : parse(end);
  if (s === null || e === null || e < s) return 0;
  return e - s;
}

function computeTotalYearsExperience(experienceEntries) {
  const totalMonths = experienceEntries.reduce((sum, e) => sum + monthsBetween(e.start, e.is_current ? "present" : e.end), 0);
  return Math.round((totalMonths / 12) * 10) / 10;
}

function inferSeniority(totalYears) {
  if (totalYears <= 0) return "";
  if (totalYears < 1) return "Entry-level";
  if (totalYears < 3) return "Associate";
  if (totalYears < 5) return "Mid-level";
  if (totalYears < 8) return "Senior";
  if (totalYears < 12) return "Lead";
  return "Manager";
}

/* Validates a value against an enum; returns "" if not a recognized
   member instead of letting bad/foreign data land in the field. */
function coerceEnum(value, allowed) {
  return allowed.includes(value) ? value : "";
}

/* Lets the Node-side job ingestion script (scripts/ingest-jobs.js) reuse
   these exact vocabularies instead of maintaining a second copy. The
   browser only ever uses the globals above via <script src="taxonomies.js">;
   this block is a no-op there since `module` doesn't exist in that context. */
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    INSTITUTION_TYPES, DEGREE_TYPES, GPA_SCALES, EMPLOYMENT_TYPES, SENIORITY_LEVELS,
    SKILL_CATEGORIES, PROFICIENCY_LEVELS, LANGUAGE_PROFICIENCY, COMMON_LANGUAGES,
    WORK_MODE_OPTIONS, JOB_SEARCH_STATUS, INDUSTRY_LIST, CITY_SUGGESTIONS,
    DEALBREAKER_PRESETS, PAY_BRACKETS, CURRENCIES, PERIODS, WORK_AUTH_OPTIONS,
    FLEXIBILITY_OPTIONS, LEVELS, DOCUMENT_TYPES, ROLE_FAMILIES, ROLE_FAMILY_KEYWORDS,
    SENIORITY_KEYWORDS, ROLE_KEYWORDS, NON_PROFESSIONAL_TITLE_HINTS, INSTITUTION_SEED, COMPANY_SEED,
    levenshtein, normalizeAgainstList, monthsBetween, computeTotalYearsExperience,
    inferSeniority, coerceEnum, classifyRoleFamily, classifySeniority
  };
}
