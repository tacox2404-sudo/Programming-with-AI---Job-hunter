"use strict";

/* ---------------------------------------------------------------------
 * Job board — filters + match scoring against whatever profile.json
 * currently lives in this browser's localStorage (same storage key the
 * Profile Builder uses). Static sample data only; see jobs-data.js.
 * ------------------------------------------------------------------- */

const PROFILE_STORAGE_KEY = "jobHunterProfile.v3";

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
  return [...new Set(SAMPLE_JOBS.map(j => j[key]))].sort();
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
   field this sample schema has (visa sponsorship, remote availability).
   The rest of DEALBREAKER_PRESETS (unpaid, night shifts, commute time,
   rigid hours) have no matching job field here and are silently
   skipped rather than guessed at. */
function dealbreakerViolations(job, profile) {
  if (!profile) return [];
  const db = profile.preferences.dealbreakers.value.map(d => d.toLowerCase());
  const violations = [];
  if (db.includes("no visa sponsorship") && !job.visa_sponsorship) violations.push("No visa sponsorship offered");
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
  showDealbreakerConflicts: false
};

let currentProfile = null;

function jobPassesFilters(job) {
  if (filters.search) {
    const hay = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    if (!hay.includes(filters.search.toLowerCase())) return false;
  }
  if (filters.role_family.size && !filters.role_family.has(job.role_family)) return false;
  if (filters.seniority.size && !filters.seniority.has(job.seniority)) return false;
  if (filters.location_city.size && !filters.location_city.has(job.location_city)) return false;
  if (filters.work_mode.size && !filters.work_mode.has(job.work_mode)) return false;
  return true;
}

function renderJobs() {
  const list = document.getElementById("jobs-list");
  const countEl = document.getElementById("jobs-count");
  list.innerHTML = "";

  const scored = SAMPLE_JOBS
    .filter(jobPassesFilters)
    .map(job => ({ job, score: scoreJob(job, currentProfile), violations: dealbreakerViolations(job, currentProfile) }))
    .filter(({ violations }) => filters.showDealbreakerConflicts || violations.length === 0)
    .sort((a, b) => {
      const as = a.score ? a.score.score : -1, bs = b.score ? b.score.score : -1;
      if (as !== bs) return bs - as;
      return new Date(b.job.posted_date) - new Date(a.job.posted_date);
    });

  countEl.textContent = `Showing ${scored.length} of ${SAMPLE_JOBS.length} sample postings`;

  if (!scored.length) {
    list.innerHTML = "<p class=\"empty-state\">No postings match these filters.</p>";
    return;
  }

  scored.forEach(({ job, score, violations }) => {
    const card = document.createElement("div");
    card.className = "entry-card job-card";

    const head = document.createElement("div");
    head.className = "job-card-head";
    const titleBlock = document.createElement("div");
    const h4 = document.createElement("h4");
    h4.className = "job-title";
    h4.textContent = job.title;
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
    [job.role_family, job.seniority, job.employment_type, job.company_industry, `${job.pay_bracket} ${job.currency}`].forEach(t => {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = t;
      tagRow.appendChild(span);
    });
    if (job.visa_sponsorship) {
      const span = document.createElement("span");
      span.className = "chip";
      span.textContent = "Visa sponsorship available";
      tagRow.appendChild(span);
    }
    card.appendChild(tagRow);

    const desc = document.createElement("p");
    desc.className = "job-desc";
    desc.textContent = job.description;
    card.appendChild(desc);

    if (job.required_skills.length) {
      const skillsRow = document.createElement("p");
      skillsRow.className = "muted";
      skillsRow.style.fontSize = "0.85rem";
      skillsRow.textContent = "Skills: " + job.required_skills.join(", ");
      card.appendChild(skillsRow);
    }

    if (score && score.missed.length) {
      const missedRow = document.createElement("p");
      missedRow.className = "muted";
      missedRow.style.fontSize = "0.82rem";
      missedRow.textContent = "Doesn't match your stated: " + score.missed.join(", ");
      card.appendChild(missedRow);
    }

    if (violations.length) {
      const warn = document.createElement("p");
      warn.className = "job-dealbreaker-warning";
      warn.textContent = "Conflicts with a dealbreaker: " + violations.join("; ");
      card.appendChild(warn);
    }

    const footer = document.createElement("p");
    footer.className = "muted job-source";
    footer.textContent = `Posted ${job.posted_date} • ${job.source}`;
    card.appendChild(footer);

    list.appendChild(card);
  });
}

function initFilters() {
  const searchInput = document.getElementById("job-search");
  searchInput.addEventListener("input", () => { filters.search = searchInput.value; renderJobs(); });

  buildFilterChips(document.getElementById("filter-role"), distinctValues("role_family"), filters.role_family, renderJobs);
  buildFilterChips(document.getElementById("filter-seniority"), distinctValues("seniority"), filters.seniority, renderJobs);
  buildFilterChips(document.getElementById("filter-location"), distinctValues("location_city"), filters.location_city, renderJobs);
  buildFilterChips(document.getElementById("filter-workmode"), distinctValues("work_mode"), filters.work_mode, renderJobs);

  const dbToggle = document.getElementById("filter-show-dealbreakers");
  dbToggle.addEventListener("change", () => { filters.showDealbreakerConflicts = dbToggle.checked; renderJobs(); });

  document.getElementById("filter-reset").addEventListener("click", () => {
    filters.search = ""; searchInput.value = "";
    filters.role_family.clear(); filters.seniority.clear(); filters.location_city.clear(); filters.work_mode.clear();
    filters.showDealbreakerConflicts = false; dbToggle.checked = false;
    buildFilterChips(document.getElementById("filter-role"), distinctValues("role_family"), filters.role_family, renderJobs);
    buildFilterChips(document.getElementById("filter-seniority"), distinctValues("seniority"), filters.seniority, renderJobs);
    buildFilterChips(document.getElementById("filter-location"), distinctValues("location_city"), filters.location_city, renderJobs);
    buildFilterChips(document.getElementById("filter-workmode"), distinctValues("work_mode"), filters.work_mode, renderJobs);
    renderJobs();
    toast("Filters reset.");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  currentProfile = loadStoredProfile();
  const banner = document.getElementById("profile-status");
  if (currentProfile) {
    const roles = currentProfile.preferences.roles.value;
    banner.textContent = roles.length
      ? `Scoring postings against your saved profile (targeting: ${roles.join(", ")}).`
      : "Found your saved profile, but no target roles are set yet — matches will be limited.";
    banner.classList.add("profile-status-found");
  } else {
    banner.textContent = "No saved profile found in this browser — build one first to see match scores, or browse postings below without them.";
  }
  initFilters();
  renderJobs();
});
