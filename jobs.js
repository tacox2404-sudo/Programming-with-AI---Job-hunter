"use strict";

/* ---------------------------------------------------------------------
 * Job board — filters + match scoring against whatever profile.json
 * currently lives in this browser's localStorage (same storage key the
 * Profile Builder uses).
 *
 * Data comes from data/jobs.json — the output of scripts/ingest-jobs.js
 * — falling back to the hand-authored data/jobs.seed.json when that
 * file doesn't exist yet (e.g. before the ingestion Action has ever
 * run) or is empty. See PROTOCOL.md for the full pipeline.
 * ------------------------------------------------------------------- */

/* In the browser this relies on taxonomies.js already having run as a
   preceding <script> tag (classic-script shared global scope — same
   pattern app.js uses). Under Node (tests/ only) there's no such shared
   scope, so pull the same constants in as globals here instead of
   rewriting every reference below. */
if (typeof module !== "undefined" && module.exports) {
  Object.assign(globalThis, require("./taxonomies.js"));
}

const PROFILE_STORAGE_KEY = "jobHunterProfile.v3";
let JOBS = [];
let jobsSourceLabel = "";

async function loadJobs() {
  try {
    const res = await fetch("data/jobs.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length) { jobsSourceLabel = "ingested postings"; return data; }
    }
  } catch (e) { /* fall through to seed */ }
  try {
    const res = await fetch("data/jobs.seed.json", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) { jobsSourceLabel = "sample postings"; return data; }
    }
  } catch (e) { /* nothing we can do */ }
  jobsSourceLabel = "postings";
  return [];
}

function loadStoredProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) { el = document.createElement("div"); el.id = "toast"; el.className = "toast"; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1600);
}

function distinctValues(key) {
  return [...new Set(JOBS.map(j => j[key]).filter(Boolean))].sort();
}

function buildFilterChips(container, options, selectedSet, onChange) {
  container.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "check-chips";
  options.forEach(opt => {
    const label = document.createElement("label");
    label.className = "check-chip" + (selectedSet.has(opt) ? " checked" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = selectedSet.has(opt);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedSet.add(opt); else selectedSet.delete(opt);
      label.classList.toggle("checked", cb.checked);
      onChange();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(opt));
    wrap.appendChild(label);
  });
  container.appendChild(wrap);
}

/* ---------------------------------------------------------------------
 * Match scoring against the stored profile. Only scores axes where the
 * profile actually states a preference, so an empty/unstated field
 * never counts against a job. `applicable` is how many axes were
 * scoreable at all — used to show "no profile" / "nothing to compare"
 * states honestly instead of a misleading 0/5.
 *
 * Level↔seniority mapping is intentionally partial: the profile's
 * "levels" taxonomy (job-search stage: Internship, Graduate scheme,
 * Entry-level, Junior, Associate, Other) and a job's "seniority"
 * (career level: Intern..Executive) aren't the same axis and only
 * partly overlap. Unmapped levels are left out of scoring rather than
 * guessed at — a real fix would be reconciling the two taxonomies.
 * ------------------------------------------------------------------- */

const LEVEL_TO_SENIORITY = { "Internship": "Intern", "Entry-level": "Entry-level" };
const PAY_ORDER = PAY_BRACKETS;

function payMeetsFloor(jobBracket, floorBracket) {
  const ji = PAY_ORDER.indexOf(jobBracket), fi = PAY_ORDER.indexOf(floorBracket);
  if (ji < 0 || fi < 0) return null;
  return ji >= fi;
}

function scoreJob(job, profile) {
  if (!profile) return null;
  const prefs = profile.preferences;
  const matched = [], missed = [];
  let score = 0, applicable = 0;

  if (prefs.roles.value.length) {
    applicable++;
    const rf = job.role_family.toLowerCase();
    const hit = prefs.roles.value.some(r => {
      const rl = r.trim().toLowerCase();
      return rl === rf || rf.includes(rl) || rl.includes(rf);
    });
    if (hit) { score++; matched.push("role"); } else missed.push("role");
  }
  const mappedSeniorities = prefs.levels.value.map(l => LEVEL_TO_SENIORITY[l]).filter(Boolean);
  if (mappedSeniorities.length) {
    applicable++;
    if (mappedSeniorities.includes(job.seniority)) { score++; matched.push("level"); } else missed.push("level");
  }
  if (prefs.locations.value.length) {
    applicable++;
    const loc = job.location_city.toLowerCase();
    const hit = prefs.locations.value.some(l => {
      const ll = l.trim().toLowerCase();
      return loc.includes(ll) || ll.includes(loc);
    });
    if (hit) { score++; matched.push("location"); } else missed.push("location");
  }
  if (prefs.industries.value.length) {
    applicable++;
    const hit = prefs.industries.value.some(i => i.toLowerCase() === job.company_industry.toLowerCase());
    if (hit) { score++; matched.push("industry"); } else missed.push("industry");
  }
  if (prefs.pay_floor.value.bracket) {
    applicable++;
    const meets = payMeetsFloor(job.pay_bracket, prefs.pay_floor.value.bracket);
    if (meets) { score++; matched.push("pay"); } else missed.push("pay");
  }
  return { score, applicable, matched, missed };
}

/* Only checks the dealbreaker presets that actually correspond to a
   field this schema has (visa sponsorship, remote availability). The
   rest of DEALBREAKER_PRESETS (unpaid, night shifts, commute time,
   rigid hours) have no matching job field here and are silently
   skipped rather than guessed at.
   visa_sponsorship is a tri-state (true / false / null-unknown) once
   ingested postings are in play — null means the source never said,
   which must NOT be treated the same as an explicit "no". */
function dealbreakerViolations(job, profile) {
  if (!profile) return [];
  const db = profile.preferences.dealbreakers.value.map(d => d.toLowerCase());
  const violations = [];
  if (db.includes("no visa sponsorship") && job.visa_sponsorship === false) violations.push("No visa sponsorship offered");
  if (db.includes("no remote option at all") && job.work_mode === "Onsite") violations.push("Onsite only, no remote option");
  return violations;
}

/* ---------------------------------------------------------------------
 * Rendering
 * ------------------------------------------------------------------- */

const filters = {
  search: "",
  role_family: new Set(),
  seniority: new Set(),
  location_city: new Set(),
  work_mode: new Set(),
  company_industry: new Set(),
  showDealbreakerConflicts: false,
  companyVerified: false,
  finCon: false,
  // Matching is an optional extra on top of the independent board, not a
  // dependency — off by default (and disabled outright) when there's no
  // profile to compare against; the postings/filters below never change
  // shape based on this, only their score/sort/dealbreaker-warning extras.
  matchEnabled: false
};

let currentProfile = null;
let viewMode = "cards"; // "cards" | "table"
const tableSort = { key: "posted_date", dir: "desc" };

/* Quick filter, not a real registry-backed classification — just the
   role_family/industry values most relevant to "get the finance and
   consulting ones first", requested since the dataset is small enough
   that scrolling past everything else to find them is real friction. */
const FINANCE_CONSULTING_ROLES = new Set(["Financial analyst", "Accountant", "Consultant", "Business analyst"]);
const FINANCE_CONSULTING_INDUSTRIES = new Set(["Financials", "Consulting"]);

function jobPassesFilters(job) {
  if (filters.search) {
    const hay = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    if (!hay.includes(filters.search.toLowerCase())) return false;
  }
  if (filters.role_family.size && !filters.role_family.has(job.role_family)) return false;
  if (filters.seniority.size && !filters.seniority.has(job.seniority)) return false;
  if (filters.location_city.size && !filters.location_city.has(job.location_city)) return false;
  if (filters.work_mode.size && !filters.work_mode.has(job.work_mode)) return false;
  if (filters.company_industry.size && !filters.company_industry.has(job.company_industry)) return false;
  if (filters.companyVerified && !job.company_verified) return false;
  if (filters.finCon && !(FINANCE_CONSULTING_ROLES.has(job.role_family) || FINANCE_CONSULTING_INDUSTRIES.has(job.company_industry))) return false;
  return true;
}

/* Shared by both views: the filtered/scored/sorted job list. The table
   view re-sorts this by whatever column the user clicked (tableSort),
   the card view always sorts by match score then recency — same
   underlying data, two different lenses on it. */
function getScoredJobs() {
  const matching = filters.matchEnabled && currentProfile;
  return JOBS
    .filter(jobPassesFilters)
    .map(job => ({ job, score: matching ? scoreJob(job, currentProfile) : null, violations: matching ? dealbreakerViolations(job, currentProfile) : [] }))
    .filter(({ violations }) => filters.showDealbreakerConflicts || violations.length === 0);
}

function renderJobs() {
  const scored = getScoredJobs();
  document.getElementById("jobs-count").textContent = `Showing ${scored.length} of ${JOBS.length} ${jobsSourceLabel}`;
  if (viewMode === "table") renderTableView(scored); else renderCardsView(scored);
}

function renderCardsView(unsorted) {
  const list = document.getElementById("jobs-list");
  list.innerHTML = "";

  const scored = unsorted.slice().sort((a, b) => {
    const as = a.score ? a.score.score : -1, bs = b.score ? b.score.score : -1;
    if (as !== bs) return bs - as;
    return new Date(b.job.posted_date) - new Date(a.job.posted_date);
  });

  if (!scored.length) {
    list.innerHTML = "<p class=\"empty-state\">No postings match these filters.</p>";
    return;
  }

  // Denser than before on purpose ("streamline... see more at once"):
  // one line of tags, a one-line truncated description, no separate
  // skills/missed-match paragraphs — click the card for the rest.
  scored.forEach(({ job, score, violations }) => {
    const card = document.createElement("div");
    card.className = "entry-card job-card job-card-compact";
    card.addEventListener("click", () => openJobDetail(job));

    const head = document.createElement("div");
    head.className = "job-card-head";
    const titleBlock = document.createElement("div");
    const h4 = document.createElement("h4");
    h4.className = "job-title";
    h4.textContent = job.title + (job.company_verified ? " ✓" : "");
    const sub = document.createElement("p");
    sub.className = "muted job-sub";
    sub.textContent = `${job.company} • ${job.location_city} • ${job.work_mode}`;
    titleBlock.appendChild(h4);
    titleBlock.appendChild(sub);
    head.appendChild(titleBlock);

    if (score) {
      const badge = document.createElement("div");
      badge.className = "match-score" + (score.applicable === 0 ? " match-score-none" : "");
      badge.textContent = score.applicable === 0 ? "No comparable preferences" : `${score.score}/${score.applicable} match`;
      badge.title = score.matched.length ? `Matches: ${score.matched.join(", ")}` : "";
      head.appendChild(badge);
    }
    card.appendChild(head);

    const tagRow = document.createElement("div");
    tagRow.className = "job-tags";
    const payTag = job.pay_bracket ? `${job.pay_bracket}${job.currency ? " " + job.currency : ""}` : "";
    [job.role_family, job.seniority, job.company_industry, payTag].filter(Boolean).slice(0, 4).forEach(t => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      tagRow.appendChild(span);
    });
    card.appendChild(tagRow);

    if (violations.length) {
      const warn = document.createElement("p");
      warn.className = "job-dealbreaker-warning";
      warn.textContent = "Conflicts with a dealbreaker: " + violations.join("; ");
      card.appendChild(warn);
    }

    list.appendChild(card);
  });
}

/* Full posting details, shown on click instead of cramming everything
   into every card — the click target is the same job object filtered/
   scored on the board, so nothing here duplicates that logic. */
function openJobDetail(job) {
  const overlay = document.getElementById("job-detail-overlay");
  const body = document.getElementById("job-detail-body");
  body.innerHTML = "";

  const h3 = document.createElement("h3");
  h3.style.margin = "0 30px 4px 0";
  h3.textContent = job.title || "(untitled)";
  body.appendChild(h3);

  const sub = document.createElement("p");
  sub.className = "muted";
  sub.textContent = `${job.company}${job.company_verified ? " (verified)" : ""} • ${job.location_city || "Location unknown"} • ${job.work_mode || "Work mode unknown"}`;
  body.appendChild(sub);

  const tagRow = document.createElement("div");
  tagRow.className = "job-tags";
  const payTag = job.pay_bracket ? `${job.pay_bracket}${job.currency ? " " + job.currency : ""}` : "";
  [job.role_family, job.seniority, job.employment_type, job.company_industry, payTag].filter(Boolean).forEach(t => {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = t;
    tagRow.appendChild(span);
  });
  if (job.visa_sponsorship === true) {
    const span = document.createElement("span");
    span.className = "chip";
    span.textContent = "Visa sponsorship available";
    tagRow.appendChild(span);
  }
  body.appendChild(tagRow);

  const desc = document.createElement("p");
  desc.className = "job-desc";
  desc.textContent = job.description || "No description provided by the source.";
  body.appendChild(desc);

  if (job.required_skills && job.required_skills.length) {
    const skillsRow = document.createElement("p");
    skillsRow.className = "muted";
    skillsRow.textContent = "Skills: " + job.required_skills.join(", ");
    body.appendChild(skillsRow);
  }

  const footer = document.createElement("p");
  footer.className = "muted job-source";
  const postedText = job.posted_date ? `Posted ${job.posted_date}` : "Posted date unknown";
  footer.textContent = `${postedText} • ${job.source}`;
  body.appendChild(footer);

  if (job.source_url) {
    const link = document.createElement("a");
    link.href = job.source_url; link.target = "_blank"; link.rel = "noopener noreferrer";
    link.textContent = "View original posting →";
    link.className = "btn small primary";
    link.style.marginTop = "10px";
    link.style.display = "inline-block";
    body.appendChild(link);
  }

  overlay.classList.remove("hidden");
}

function closeJobDetail() {
  document.getElementById("job-detail-overlay").classList.add("hidden");
}

/* "Real tracker... like an excel sheet type" — a sortable table over the
   same filtered data the card view shows, for scanning many postings at
   once instead of reading one card at a time. Click a header to sort by
   that column; click again to flip direction. */
const TABLE_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "company", label: "Company" },
  { key: "company_industry", label: "Industry" },
  { key: "role_family", label: "Role" },
  { key: "seniority", label: "Seniority" },
  { key: "location_city", label: "Location" },
  { key: "work_mode", label: "Work mode" },
  { key: "employment_type", label: "Type" },
  { key: "posted_date", label: "Posted" },
  { key: "source", label: "Source" }
];

function renderTableView(unsorted) {
  const wrap = document.getElementById("jobs-table-wrap");
  wrap.innerHTML = "";
  if (!unsorted.length) {
    wrap.innerHTML = "<p class=\"empty-state\">No postings match these filters.</p>";
    return;
  }

  const sorted = unsorted.slice().sort((a, b) => {
    const key = tableSort.key;
    let av = a.job[key] || "", bv = b.job[key] || "";
    let cmp;
    if (key === "posted_date") cmp = new Date(av || 0) - new Date(bv || 0);
    else cmp = String(av).localeCompare(String(bv));
    return tableSort.dir === "asc" ? cmp : -cmp;
  });

  const scroll = document.createElement("div");
  scroll.className = "jobs-table-scroll";
  const table = document.createElement("table");
  table.className = "jobs-table";

  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  TABLE_COLUMNS.forEach(col => {
    const th = document.createElement("th");
    th.textContent = col.label;
    if (tableSort.key === col.key) {
      th.classList.add("sorted");
      th.setAttribute("data-dir", tableSort.dir === "asc" ? "▲" : "▼");
    }
    th.addEventListener("click", () => {
      if (tableSort.key === col.key) tableSort.dir = tableSort.dir === "asc" ? "desc" : "asc";
      else { tableSort.key = col.key; tableSort.dir = "asc"; }
      renderTableView(unsorted);
    });
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  sorted.forEach(({ job }) => {
    const tr = document.createElement("tr");
    tr.addEventListener("click", () => openJobDetail(job));
    TABLE_COLUMNS.forEach(col => {
      const td = document.createElement("td");
      if (col.key === "title") {
        td.className = "job-title-cell";
        td.textContent = job.title || "(untitled)";
      } else if (col.key === "company") {
        td.className = job.company_verified ? "verified-cell" : "";
        td.textContent = (job.company || "—") + (job.company_verified ? " ✓" : "");
      } else {
        td.textContent = job[col.key] || "—";
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  scroll.appendChild(table);
  wrap.appendChild(scroll);
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById("view-cards").className = "btn small" + (mode === "cards" ? "" : " secondary");
  document.getElementById("view-table").className = "btn small" + (mode === "table" ? "" : " secondary");
  document.getElementById("jobs-list").classList.toggle("hidden", mode !== "cards");
  document.getElementById("jobs-table-wrap").classList.toggle("hidden", mode !== "table");
  renderJobs();
}

function refreshFilterChipUI() {
  buildFilterChips(document.getElementById("filter-role"), distinctValues("role_family"), filters.role_family, onFilterChipChange);
  buildFilterChips(document.getElementById("filter-seniority"), distinctValues("seniority"), filters.seniority, onFilterChipChange);
  buildFilterChips(document.getElementById("filter-location"), distinctValues("location_city"), filters.location_city, onFilterChipChange);
  buildFilterChips(document.getElementById("filter-workmode"), distinctValues("work_mode"), filters.work_mode, onFilterChipChange);
  buildFilterChips(document.getElementById("filter-industry"), distinctValues("company_industry"), filters.company_industry, onFilterChipChange);
}
function onFilterChipChange() { updateFiltersCount(); renderSuggestedFilters(); renderJobs(); }

/* Optional, click-to-apply suggestions derived from the saved profile's
   stated role/location preferences — only shown when matching is turned
   on, and only for axes that already have a real filter control to apply
   to (no industry filter UI exists yet, so industry preferences aren't
   suggested here). Applying one just checks the matching filter chip
   through the normal filters state, same as the user checking it by
   hand — nothing about this bypasses or duplicates the filter logic. */
function renderSuggestedFilters() {
  const container = document.getElementById("suggested-filters");
  if (!container) return;
  container.innerHTML = "";
  if (!filters.matchEnabled || !currentProfile) return;
  const prefs = currentProfile.preferences;
  const suggestions = [];

  const roleVals = distinctValues("role_family");
  prefs.roles.value.forEach(r => {
    const match = roleVals.find(v => v.toLowerCase() === r.trim().toLowerCase());
    if (match && !filters.role_family.has(match)) suggestions.push({ label: `Role: ${match}`, apply: () => filters.role_family.add(match) });
  });
  const locVals = distinctValues("location_city");
  prefs.locations.value.forEach(l => {
    const ll = l.trim().toLowerCase();
    const match = locVals.find(v => v.toLowerCase().includes(ll) || ll.includes(v.toLowerCase()));
    if (match && !filters.location_city.has(match)) suggestions.push({ label: `Location: ${match}`, apply: () => filters.location_city.add(match) });
  });

  if (!suggestions.length) return;
  const label = document.createElement("p");
  label.className = "muted";
  label.style.fontSize = "0.85rem";
  label.style.margin = "8px 0 4px";
  label.textContent = "Suggested filters based on your profile (click to apply):";
  container.appendChild(label);
  const wrap = document.createElement("div");
  wrap.className = "check-chips";
  suggestions.forEach(s => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = "+ " + s.label;
    btn.addEventListener("click", () => { s.apply(); refreshFilterChipUI(); renderSuggestedFilters(); renderJobs(); });
    wrap.appendChild(btn);
  });
  container.appendChild(wrap);
}

function updateFiltersCount() {
  const n = filters.role_family.size + filters.seniority.size + filters.location_city.size
    + filters.work_mode.size + filters.company_industry.size + (filters.showDealbreakerConflicts ? 1 : 0);
  const el = document.getElementById("filters-active-count");
  el.textContent = n;
  el.classList.toggle("hidden", n === 0);
}

function initFilters() {
  const searchInput = document.getElementById("job-search");
  searchInput.addEventListener("input", () => { filters.search = searchInput.value; renderJobs(); });

  const verifiedToggle = document.getElementById("filter-verified");
  verifiedToggle.addEventListener("change", () => {
    filters.companyVerified = verifiedToggle.checked;
    document.getElementById("filter-verified-wrap").classList.toggle("checked", verifiedToggle.checked);
    renderJobs();
  });
  const finConToggle = document.getElementById("filter-fincon");
  finConToggle.addEventListener("change", () => {
    filters.finCon = finConToggle.checked;
    document.getElementById("filter-fincon-wrap").classList.toggle("checked", finConToggle.checked);
    renderJobs();
  });

  document.getElementById("job-detail-close").addEventListener("click", closeJobDetail);
  document.getElementById("job-detail-overlay").addEventListener("click", (e) => {
    if (e.target.id === "job-detail-overlay") closeJobDetail();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeJobDetail(); });

  refreshFilterChipUI();

  const matchToggle = document.getElementById("filter-match-toggle");
  if (currentProfile) {
    matchToggle.addEventListener("change", () => {
      filters.matchEnabled = matchToggle.checked;
      renderSuggestedFilters();
      renderJobs();
    });
  } else {
    matchToggle.disabled = true;
    document.getElementById("filter-match-wrap").title = "Build a profile first to enable matching.";
  }

  const dbToggle = document.getElementById("filter-show-dealbreakers");
  dbToggle.addEventListener("change", () => { filters.showDealbreakerConflicts = dbToggle.checked; updateFiltersCount(); renderJobs(); });

  document.getElementById("filter-reset").addEventListener("click", () => {
    filters.search = ""; searchInput.value = "";
    filters.role_family.clear(); filters.seniority.clear(); filters.location_city.clear(); filters.work_mode.clear();
    filters.company_industry.clear();
    filters.showDealbreakerConflicts = false; dbToggle.checked = false;
    filters.companyVerified = false; verifiedToggle.checked = false;
    document.getElementById("filter-verified-wrap").classList.remove("checked");
    filters.finCon = false; finConToggle.checked = false;
    document.getElementById("filter-fincon-wrap").classList.remove("checked");
    refreshFilterChipUI();
    updateFiltersCount();
    renderSuggestedFilters();
    renderJobs();
    toast("Filters reset.");
  });

  document.getElementById("view-cards").addEventListener("click", () => setViewMode("cards"));
  document.getElementById("view-table").addEventListener("click", () => setViewMode("table"));
}

/* Guarded: this file is also require()'d from tests/ under Node, where
   there's no `document` to attach to and no page lifecycle to run. */
if (typeof document !== "undefined") {
  document.addEventListener("DOMContentLoaded", async () => {
    currentProfile = loadStoredProfile();
    const banner = document.getElementById("profile-status");
    if (currentProfile) {
      filters.matchEnabled = true;
      document.getElementById("filter-match-toggle").checked = true;
      const roles = currentProfile.preferences.roles.value;
      banner.textContent = roles.length
        ? `Matching is on by default — scoring postings against your saved profile (targeting: ${roles.join(", ")}). Turn it off in Filters to browse independently.`
        : "Found your saved profile, but no target roles are set yet — matches will be limited. Turn matching off in Filters to browse independently.";
      banner.classList.add("profile-status-found");
    } else {
      banner.textContent = "No saved profile found in this browser — build one first to enable match scores, or browse postings below without them.";
    }

    document.getElementById("jobs-count").textContent = "Loading postings…";
    JOBS = await loadJobs();
    initFilters();
    renderSuggestedFilters();
    renderJobs();
  });
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { scoreJob, dealbreakerViolations, payMeetsFloor, LEVEL_TO_SENIORITY };
}
