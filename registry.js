"use strict";

/* ---------------------------------------------------------------------
 * Loads the real reference datasets in data/registry/*.json and offers
 * a fuzzy-match that stays fast against the university list (10,240
 * entries) — plain normalizeAgainstList() in taxonomies.js runs a full
 * Levenshtein pass over the whole candidate list per call, fine for the
 * tiny *_SEED lists it was built for, far too slow to do 10k times on
 * every blur event.
 *
 * Shared by app.js (Profile Builder) and jobs.js (Job Board) — one
 * fetch of each file per page load, cached in module-level consts.
 * scripts/ingest-jobs.js (Node, not a browser) reads these same JSON
 * files directly off disk instead of through this loader.
 * ------------------------------------------------------------------- */

let UNIVERSITIES = [];   // [{name, country}]
let COMPANIES = [];      // [{name, country, industry, source}]
let LOCATIONS = [];      // [{city, country, display}]
let registryLoaded = false;

async function loadRegistry() {
  async function fetchJson(path, fallback) {
    try {
      const res = await fetch(path, { cache: "force-cache" });
      if (!res.ok) return fallback;
      const data = await res.json();
      return Array.isArray(data) ? data : fallback;
    } catch (e) { return fallback; }
  }
  [UNIVERSITIES, COMPANIES, LOCATIONS] = await Promise.all([
    fetchJson("data/registry/universities.json", []),
    fetchJson("data/registry/companies.json", []),
    fetchJson("data/registry/locations.json", [])
  ]);
  registryLoaded = true;
  return { UNIVERSITIES, COMPANIES, LOCATIONS };
}

/* Groups entries by the lowercase first character of keyFn(entry), so a
   fuzzy match only has to run Levenshtein against the ~1/26th of the
   list that could plausibly be a typo of the input, instead of all of
   it. Good enough for "wrong letter later in the word", not for "wrong
   first letter" — an acceptable trade for interactive-speed matching
   against a 10k-entry list in the browser. */
function buildPrefixIndex(list, keyFn) {
  const index = new Map();
  list.forEach(item => {
    const k = (keyFn(item) || "").trim().charAt(0).toLowerCase();
    if (!k) return;
    if (!index.has(k)) index.set(k, []);
    index.get(k).push(item);
  });
  return index;
}

/* Same contract as normalizeAgainstList() in taxonomies.js — returns
   {canonical, matched, entry}; canonical is the unchanged input and
   matched is false unless confident enough to auto-correct. entry is
   the full matched registry record (so callers can pull country/
   industry/etc. off a confirmed match), null when unmatched. */
/* Very common, unambiguous abbreviations worth expanding before the
   distance check — "Univ" for "University" is everyday shorthand, not
   a typo, and at typical name lengths it's too many characters short
   for a strict edit-distance threshold to forgive on its own. */
const COMMON_ABBREVIATIONS = [
  [/\buniv\.?$/i, "university"],
  [/\bcorp\.?$/i, "corporation"],
  [/\btech\.?$/i, "technology"],
  [/\bintl\.?$/i, "international"]
];
function expandAbbreviations(s) {
  let out = s;
  COMMON_ABBREVIATIONS.forEach(([re, full]) => { out = out.replace(re, full); });
  return out;
}

function normalizeAgainstRegistry(input, list, keyFn, prefixIndex) {
  const trimmed = (input || "").trim();
  if (!trimmed) return { canonical: "", matched: false, entry: null };
  const lower = trimmed.toLowerCase();

  const exact = list.find(item => (keyFn(item) || "").toLowerCase() === lower);
  if (exact) return { canonical: keyFn(exact), matched: true, entry: exact };

  const expanded = expandAbbreviations(trimmed);
  const bucket = (prefixIndex && prefixIndex.get(lower.charAt(0))) || list;
  let best = null, bestDist = Infinity;
  bucket.forEach(item => {
    const name = keyFn(item);
    if (!name) return;
    const d = Math.min(levenshtein(trimmed, name), levenshtein(expanded, name));
    if (d < bestDist) { bestDist = d; best = item; }
  });
  const threshold = Math.max(2, Math.round(trimmed.length * 0.3));
  if (best && bestDist <= threshold) return { canonical: keyFn(best), matched: true, entry: best };
  return { canonical: trimmed, matched: false, entry: null };
}
