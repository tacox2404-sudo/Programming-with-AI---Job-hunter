"use strict";

/* ---------------------------------------------------------------------
 * Controlled vocabularies for the profile. Every enum-backed field in
 * the app pulls its options from here and nowhere else, so a filter or
 * matcher built later only ever sees one of these fixed values — never
 * free text, never null/undefined (empty string is the "unset" value
 * throughout instead).
 *
 * The *_SEED lists (institutions, companies) are small, illustrative
 * canonical-name lists for the fuzzy-normalize demo below, not a real
 * registry. A real implementation would back this with an actual
 * institution/company/ESCO-skill database — out of scope for a POC.
 * ------------------------------------------------------------------- */

const INSTITUTION_TYPES = ["University", "College", "Bootcamp", "Online course / certification", "Vocational school", "High school", "Other"];
const DEGREE_TYPES = ["High school diploma", "Associate", "Bachelor's", "Master's", "MBA", "PhD", "Professional certificate", "Bootcamp certificate", "Other"];
const GPA_SCALES = ["4.0", "5.0", "10.0", "20.0", "100", "N/A"];

const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Internship", "Contract", "Freelance", "Volunteer"];
const SENIORITY_LEVELS = ["Intern", "Entry-level", "Associate", "Mid-level", "Senior", "Lead", "Manager", "Director", "Executive"];

const SKILL_CATEGORIES = ["Technical", "Tool / software", "Language", "Domain knowledge", "Soft skill", "Certification"];
const PROFICIENCY_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];

const LANGUAGE_PROFICIENCY = ["A1", "A2", "B1", "B2", "C1", "C2", "Native"];
const COMMON_LANGUAGES = ["English", "Spanish", "French", "German", "Italian", "Portuguese", "Mandarin", "Arabic", "Hindi", "Japanese", "Korean", "Dutch", "Russian"];

const WORK_MODE_OPTIONS = ["Remote", "Hybrid", "Onsite", "Flexible / no preference"];
const JOB_SEARCH_STATUS = ["Actively looking", "Open to offers", "Not looking"];

const INDUSTRY_LIST = [
  "Technology / Software", "Fintech", "Banking & Finance", "Healthcare", "Education",
  "E-commerce & Retail", "Manufacturing", "Consulting", "Non-profit", "Government",
  "Media & Entertainment", "Gaming", "Logistics", "Energy", "Insurance", "Telecom",
  "Pharma & Biotech"
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
