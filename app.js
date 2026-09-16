"use strict";

/* ---------------------------------------------------------------------
 * Job Search Profile Builder — single-page editor.
 *
 * v3: experience/education are now structured, LinkedIn-style entities
 * (seniority, employment type, industry, institution type, degree type,
 * GPA, etc.) instead of free text + a description box. Added Skills,
 * Languages and Certifications as their own entities, plus a Location &
 * mobility block, links, job-search status, and computed signals (total
 * years of experience, inferred seniority, completeness score). Every
 * enum field is validated against taxonomies.js on load so a bad or
 * foreign value can't silently sit in the data. See synthesizeSummary()
 * for where a real model call would eventually replace the template.
 * ------------------------------------------------------------------- */

/* In the browser this relies on taxonomies.js and registry.js already
   having run as preceding <script> tags (classic-script shared global
   scope). Under Node (tests/ only, for the CV-parsing functions) there's
   no such shared scope. */
if (typeof module !== "undefined" && module.exports) {
  Object.assign(globalThis, require("./taxonomies.js"));
  Object.assign(globalThis, require("./registry.js"));
}

const STORAGE_KEY = "jobHunterProfile.v3";

function emptyProfile() {
  return {
    headline: { value: "", source: "open", evidence: "" },
    story: { value: "", source: "open", evidence: "" },
    interests: [],
    mobility: {
      current_city: "", current_country: "",
      work_authorization: "", work_authorization_detail: "",
      open_to_relocate: false,
      work_mode: ""
    },
    links: { linkedin: "", github: "", portfolio: "" },
    job_search_status: "",
    preferences: {
      roles: { value: [], source: "open", evidence: "" },
      levels: { value: [], source: "open", evidence: "" },
      locations: { value: [], source: "open", evidence: "" },
      industries: { value: [], source: "open", evidence: "" },
      companies: { value: [], source: "open", evidence: "" },
      pay_floor: { value: { bracket: "", currency: "USD", period: "year" }, source: "open", evidence: "" },
      dealbreakers: { value: [], source: "open", evidence: "" },
      availability: { value: { earliest_date: "", flexibility: "" }, source: "open", evidence: "" }
    },
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    background: { extracurriculars: [] },
    context_notes: [],
    documents: []
  };
}

let profile = emptyProfile();
let idSeq = 1;
let universitiesIndex = null;
let companiesIndex = null;
function nextId() { return "e" + (idSeq++) + "_" + Date.now().toString(36); }

/* Re-validate every enum-backed field against its taxonomy. Called once
   after loading a saved (or, eventually, externally-parsed) profile so
   a bad/foreign value resets to "" instead of landing in the data. */
function revalidateProfile(p) {
  const P = p.preferences;
  P.levels.value = P.levels.value.filter(v => LEVELS.includes(v));
  P.industries.value = P.industries.value.filter(v => INDUSTRY_LIST.includes(v) || true); // custom industries allowed, kept as-is
  P.pay_floor.value.bracket = coerceEnum(P.pay_floor.value.bracket, PAY_BRACKETS);
  P.pay_floor.value.currency = coerceEnum(P.pay_floor.value.currency, CURRENCIES) || "USD";
  P.pay_floor.value.period = coerceEnum(P.pay_floor.value.period, PERIODS) || "year";
  P.availability.value.flexibility = coerceEnum(P.availability.value.flexibility, FLEXIBILITY_OPTIONS);
  P.dealbreakers.value = P.dealbreakers.value; // presets + custom both allowed as text

  p.mobility.work_authorization = coerceEnum(p.mobility.work_authorization, WORK_AUTH_OPTIONS);
  p.mobility.work_mode = coerceEnum(p.mobility.work_mode, WORK_MODE_OPTIONS);
  p.job_search_status = coerceEnum(p.job_search_status, JOB_SEARCH_STATUS);

  p.experience.forEach(e => {
    e.employment_type = coerceEnum(e.employment_type, EMPLOYMENT_TYPES);
    e.seniority = coerceEnum(e.seniority, SENIORITY_LEVELS);
    e.company_industry = coerceEnum(e.company_industry, INDUSTRY_LIST);
  });
  p.education.forEach(ed => {
    ed.institution_type = coerceEnum(ed.institution_type, INSTITUTION_TYPES);
    ed.degree_type = coerceEnum(ed.degree_type, DEGREE_TYPES);
    ed.gpa_scale = coerceEnum(ed.gpa_scale, GPA_SCALES);
  });
  p.skills.forEach(s => {
    s.category = coerceEnum(s.category, SKILL_CATEGORIES);
    s.proficiency = coerceEnum(s.proficiency, PROFICIENCY_LEVELS);
  });
  p.languages.forEach(l => { l.proficiency = coerceEnum(l.proficiency, LANGUAGE_PROFICIENCY); });
  p.documents.forEach(d => { d.doc_type = coerceEnum(d.doc_type, DOCUMENT_TYPES); });
  return p;
}

function saveProfile() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profile)); } catch (e) { /* ignore */ }
}
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
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

function badgeLabel(source) { return source === "stated" ? "Stated" : source === "lean" ? "Leaning" : "Open"; }
function badgeEl(source) {
  const span = document.createElement("span");
  span.className = `badge ${source}`;
  span.textContent = badgeLabel(source);
  return span;
}

function attachFieldChrome(hostRow, field, isEmptyFn) {
  const badge = badgeEl(field.source);
  hostRow.appendChild(badge);
  const meta = document.createElement("div");
  meta.className = "field-meta";
  const leanLabel = document.createElement("label");
  leanLabel.className = "lean-toggle";
  const leanCb = document.createElement("input");
  leanCb.type = "checkbox";
  leanCb.checked = field.source === "lean";
  leanLabel.appendChild(leanCb);
  leanLabel.appendChild(document.createTextNode(" Just leaning, not decided"));
  const reason = document.createElement("input");
  reason.type = "text";
  reason.className = "lean-reason";
  reason.placeholder = "Why are you leaning this way? (optional)";
  reason.value = field.evidence || "";
  reason.hidden = field.source !== "lean";
  meta.appendChild(leanLabel);
  meta.appendChild(reason);
  hostRow.parentElement.appendChild(meta);

  function refresh() {
    const empty = isEmptyFn();
    if (leanCb.checked && !empty) field.source = "lean";
    else if (empty) field.source = "open";
    else field.source = "stated";
    reason.hidden = field.source !== "lean";
    badge.className = `badge ${field.source}`;
    badge.textContent = badgeLabel(field.source);
    saveProfile();
    refreshCompleteness();
  }
  leanCb.addEventListener("change", refresh);
  reason.addEventListener("blur", () => { field.evidence = reason.value.trim(); saveProfile(); });
  return refresh;
}

function buildTagInput(container, values, onChange, opts) {
  opts = opts || {};
  const wrap = document.createElement("div");
  wrap.className = "chip-input";
  // opts.knownValues may be an array (snapshot) or a function (re-read
  // fresh on every redraw) — the latter is how the locations field
  // picks up the real registry once it finishes loading a moment after
  // this input was first built.
  function currentKnownList() {
    const kv = typeof opts.knownValues === "function" ? opts.knownValues() : opts.knownValues;
    return kv ? kv.map(v => v.toLowerCase()) : null;
  }

  function redraw() {
    const knownList = currentKnownList();
    wrap.querySelectorAll(".chip").forEach(c => c.remove());
    values.forEach((v, i) => {
      const chip = document.createElement("span");
      chip.className = "chip" + (knownList && !knownList.includes(v.toLowerCase()) ? " custom" : "");
      if (chip.classList.contains("custom")) chip.title = "Not in our standard list — double-check the spelling.";
      chip.textContent = v;
      const rm = document.createElement("button");
      rm.type = "button";
      rm.textContent = "×";
      rm.addEventListener("click", () => { values.splice(i, 1); redraw(); onChange(); });
      chip.appendChild(rm);
      wrap.insertBefore(chip, wrap.lastChild);
    });
  }
  const input = document.createElement("input");
  input.type = "text";
  if (opts.datalistId) input.setAttribute("list", opts.datalistId);
  input.placeholder = opts.placeholder || "Type and press Enter";
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      const v = input.value.trim();
      if (!values.some(x => x.toLowerCase() === v.toLowerCase())) values.push(v);
      input.value = "";
      redraw();
      onChange();
    }
  });
  wrap.appendChild(input);
  redraw();
  container.appendChild(wrap);
  return redraw;
}

function buildCheckChips(container, options, values, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "check-chips";
  options.forEach(opt => {
    const label = document.createElement("label");
    label.className = "check-chip" + (values.includes(opt) ? " checked" : "");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = values.includes(opt);
    cb.addEventListener("change", () => {
      if (cb.checked) { if (!values.includes(opt)) values.push(opt); }
      else { const i = values.indexOf(opt); if (i > -1) values.splice(i, 1); }
      label.classList.toggle("checked", cb.checked);
      onChange();
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(opt));
    wrap.appendChild(label);
  });
  container.appendChild(wrap);
}

function buildSelect(options, selected, placeholder) {
  const select = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = placeholder;
  select.appendChild(blank);
  options.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt; o.textContent = opt;
    if (selected === opt) o.selected = true;
    select.appendChild(o);
  });
  return select;
}

/* ---------------------------------------------------------------------
 * Simple preference fields (roles / levels / locations / industries /
 * companies / pay / dealbreakers / interests / availability)
 * ------------------------------------------------------------------- */

let rolesHooks = null;
function renderRoles() {
  const host = document.getElementById("field-roles");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.roles;
  let refresh;
  const redraw = buildTagInput(host, field.value, () => refresh(), { datalistId: "role-suggestions", placeholder: "e.g. data analyst — Enter to add" });
  refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
  rolesHooks = { redraw, refresh };
}

function renderLevels() {
  const host = document.getElementById("field-levels");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.levels;
  buildCheckChips(host, LEVELS, field.value, () => refresh());
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
}

let locationsHooks = null;
function renderLocations() {
  const host = document.getElementById("field-locations");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.locations;
  const redraw = buildTagInput(host, field.value, () => refresh(), {
    datalistId: "city-suggestions",
    knownValues: () => (LOCATIONS.length ? LOCATIONS.map(l => l.display) : CITY_SUGGESTIONS),
    placeholder: "Pick or type a city — Enter to add"
  });
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
  locationsHooks = { redraw };
}

function renderAvailability() {
  const host = document.getElementById("field-availability");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.availability;
  const wrap = document.createElement("div");
  wrap.className = "row";
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.value = field.value.earliest_date || "";
  const flexSelect = buildSelect(FLEXIBILITY_OPTIONS, field.value.flexibility, "Flexibility…");
  dateInput.addEventListener("change", () => { field.value.earliest_date = dateInput.value; refresh(); });
  flexSelect.addEventListener("change", () => { field.value.flexibility = flexSelect.value; refresh(); });
  wrap.appendChild(dateInput);
  wrap.appendChild(flexSelect);
  host.appendChild(wrap);
  const refresh = attachFieldChrome(row, field, () => !field.value.earliest_date && !field.value.flexibility);
  refresh();
}

function renderIndustries() {
  const host = document.getElementById("field-industries");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.industries;
  buildCheckChips(host, INDUSTRY_LIST, field.value, () => refresh());
  const customWrap = document.createElement("div");
  customWrap.style.marginTop = "8px";
  const customValues = field.value.filter(v => !INDUSTRY_LIST.includes(v));
  buildTagInput(customWrap, customValues, () => {
    field.value = field.value.filter(v => INDUSTRY_LIST.includes(v)).concat(customValues);
    refresh();
  }, { placeholder: "Other industry — Enter to add" });
  host.appendChild(customWrap);
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
}

function renderCompanies() {
  const host = document.getElementById("field-companies");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.companies;
  buildTagInput(host, field.value, () => refresh(), { placeholder: "Company name — Enter to add", datalistId: "company-suggestions" });
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
}

function renderPay() {
  const host = document.getElementById("field-pay");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.pay_floor;
  const wrap = document.createElement("div");
  wrap.className = "row";
  const bracketSelect = buildSelect(PAY_BRACKETS, field.value.bracket, "Minimum bracket…");
  const currencySelect = document.createElement("select");
  CURRENCIES.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    if (field.value.currency === c) o.selected = true;
    currencySelect.appendChild(o);
  });
  const periodSelect = document.createElement("select");
  PERIODS.forEach(p => {
    const o = document.createElement("option");
    o.value = p; o.textContent = "per " + p;
    if (field.value.period === p) o.selected = true;
    periodSelect.appendChild(o);
  });
  bracketSelect.addEventListener("change", () => { field.value.bracket = bracketSelect.value; refresh(); });
  currencySelect.addEventListener("change", () => { field.value.currency = currencySelect.value; saveProfile(); });
  periodSelect.addEventListener("change", () => { field.value.period = periodSelect.value; saveProfile(); });
  wrap.appendChild(bracketSelect);
  wrap.appendChild(currencySelect);
  wrap.appendChild(periodSelect);
  host.appendChild(wrap);
  const refresh = attachFieldChrome(row, field, () => !field.value.bracket);
  refresh();
}

function renderDealbreakers() {
  const host = document.getElementById("field-dealbreakers");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.dealbreakers;
  buildCheckChips(host, DEALBREAKER_PRESETS, field.value, () => refresh());
  const customWrap = document.createElement("div");
  customWrap.style.marginTop = "8px";
  const customValues = field.value.filter(v => !DEALBREAKER_PRESETS.includes(v));
  buildTagInput(customWrap, customValues, () => {
    field.value = field.value.filter(v => DEALBREAKER_PRESETS.includes(v)).concat(customValues);
    refresh();
  }, { placeholder: "Other dealbreaker — Enter to add" });
  host.appendChild(customWrap);
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
}

function renderInterests() {
  const host = document.getElementById("field-interests");
  const wrap = document.createElement("div");
  wrap.className = "chip-input";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Add an interest — Enter to add";
  function redraw() {
    wrap.querySelectorAll(".chip").forEach(c => c.remove());
    profile.interests.forEach((item, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item.value;
      const rm = document.createElement("button");
      rm.type = "button"; rm.textContent = "×";
      rm.addEventListener("click", () => { profile.interests.splice(i, 1); saveProfile(); redraw(); });
      chip.appendChild(rm);
      wrap.insertBefore(chip, input);
    });
  }
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      profile.interests.push({ value: input.value.trim(), source: "stated" });
      input.value = "";
      saveProfile();
      redraw();
    }
  });
  wrap.appendChild(input);
  redraw();
  host.appendChild(wrap);
}

/* ---------------------------------------------------------------------
 * Location & mobility, links, job search status
 * ------------------------------------------------------------------- */

function initMobility() {
  const m = profile.mobility;
  const city = document.getElementById("loc-city");
  const country = document.getElementById("loc-country");
  const authDetail = document.getElementById("loc-workauth-detail");
  const relocate = document.getElementById("loc-relocate");

  city.value = m.current_city;
  country.value = m.current_country;
  authDetail.value = m.work_authorization_detail;
  relocate.checked = m.open_to_relocate;

  const authSelect = buildSelect(WORK_AUTH_OPTIONS, m.work_authorization, "Work authorization…");
  authSelect.id = "loc-workauth";
  document.getElementById("loc-workauth").replaceWith(authSelect);

  const modeSelect = buildSelect(WORK_MODE_OPTIONS, m.work_mode, "Work mode preference…");
  modeSelect.id = "loc-workmode";
  document.getElementById("loc-workmode").replaceWith(modeSelect);

  city.addEventListener("blur", () => { m.current_city = city.value.trim(); saveProfile(); refreshCompleteness(); });
  country.addEventListener("blur", () => { m.current_country = country.value.trim(); saveProfile(); refreshCompleteness(); });
  authDetail.addEventListener("blur", () => { m.work_authorization_detail = authDetail.value.trim(); saveProfile(); });
  relocate.addEventListener("change", () => { m.open_to_relocate = relocate.checked; saveProfile(); refreshCompleteness(); });
  authSelect.addEventListener("change", () => { m.work_authorization = authSelect.value; saveProfile(); refreshCompleteness(); });
  modeSelect.addEventListener("change", () => { m.work_mode = modeSelect.value; saveProfile(); refreshCompleteness(); });
}

function initLinksAndStatus() {
  const li = document.getElementById("link-linkedin");
  const gh = document.getElementById("link-github");
  const pf = document.getElementById("link-portfolio");
  li.value = profile.links.linkedin; gh.value = profile.links.github; pf.value = profile.links.portfolio;
  li.addEventListener("blur", () => { profile.links.linkedin = li.value.trim(); saveProfile(); refreshCompleteness(); });
  gh.addEventListener("blur", () => { profile.links.github = gh.value.trim(); saveProfile(); });
  pf.addEventListener("blur", () => { profile.links.portfolio = pf.value.trim(); saveProfile(); });

  const statusSelect = buildSelect(JOB_SEARCH_STATUS, profile.job_search_status, "Job search status…");
  statusSelect.id = "job-status";
  document.getElementById("job-status").replaceWith(statusSelect);
  statusSelect.addEventListener("change", () => { profile.job_search_status = statusSelect.value; saveProfile(); refreshCompleteness(); });
}

/* ---------------------------------------------------------------------
 * Generic repeatable-entity list renderer: text / select / checkbox /
 * textarea fields, with optional canonical-name normalization on blur.
 * ------------------------------------------------------------------- */

function renderEntityList(entries, containerId, fieldDefs, describeEmpty, onChange) {
  const container = document.getElementById(containerId);
  function redraw() {
    container.innerHTML = "";
    if (!entries.length) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = describeEmpty;
      container.appendChild(p);
      return;
    }
    entries.forEach((entry, idx) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      const head = document.createElement("div");
      head.className = "entry-head";
      const span = document.createElement("span");
      span.textContent = `#${idx + 1}`;
      const rm = document.createElement("button");
      rm.className = "btn small ghost";
      rm.type = "button"; rm.textContent = "Remove";
      rm.addEventListener("click", () => { entries.splice(idx, 1); saveProfile(); redraw(); onChange && onChange(); refreshCompleteness(); });
      head.appendChild(span); head.appendChild(rm);
      card.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "entry-grid";
      fieldDefs.forEach(f => {
        if (f.type === "textarea") return;
        if (f.type === "checkbox") {
          const label = document.createElement("label");
          label.className = "check-chip";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.checked = !!entry[f.key];
          cb.addEventListener("change", () => {
            entry[f.key] = cb.checked;
            if (f.disablesKey) {
              const endInput = grid.querySelector(`[data-key="${f.disablesKey}"]`);
              if (endInput) endInput.disabled = cb.checked;
            }
            saveProfile(); onChange && onChange(); refreshCompleteness();
          });
          label.appendChild(cb);
          label.appendChild(document.createTextNode(f.label));
          grid.appendChild(label);
          return;
        }
        if (f.type === "select") {
          const select = buildSelect(f.options, entry[f.key], f.label);
          select.addEventListener("change", () => { entry[f.key] = select.value; saveProfile(); onChange && onChange(); refreshCompleteness(); });
          grid.appendChild(select);
          return;
        }
        const inp = document.createElement("input");
        inp.type = f.type === "month" ? "month" : "text";
        inp.dataset.key = f.key;
        inp.placeholder = f.label;
        inp.value = entry[f.key] || "";
        if (f.disabledIf && entry[f.disabledIf]) inp.disabled = true;
        if (f.datalistId) inp.setAttribute("list", f.datalistId);
        inp.addEventListener("blur", () => {
          let v = inp.value.trim();
          let needsRedraw = false;
          if (f.registryKind === "institution" && v && UNIVERSITIES.length) {
            const result = normalizeAgainstRegistry(v, UNIVERSITIES, u => u.name, universitiesIndex);
            if (result.matched) {
              v = result.canonical;
              inp.value = v;
              toast(result.entry ? `Verified: "${v}" (${result.entry.country})` : `Normalized to "${v}"`);
            }
          } else if (f.registryKind === "company" && v && COMPANIES.length) {
            const result = normalizeAgainstRegistry(v, COMPANIES, c => c.name, companiesIndex);
            if (result.matched) {
              v = result.canonical;
              inp.value = v;
              if (result.entry) {
                toast(`Verified: "${v}" (${result.entry.country} · ${result.entry.industry})`);
                if (!entry.company_industry && INDUSTRY_LIST.includes(result.entry.industry)) {
                  entry.company_industry = result.entry.industry;
                  needsRedraw = true; // the industry <select> only reflects this on a full redraw
                }
              } else {
                toast(`Normalized to "${v}"`);
              }
            }
          } else if (f.normalizeAgainst) {
            const result = normalizeAgainstList(v, f.normalizeAgainst);
            if (result.matched && result.canonical !== v) {
              v = result.canonical;
              inp.value = v;
              toast(`Normalized to "${v}"`);
            }
          }
          entry[f.key] = v;
          if (f.dedupeSiblings && v) {
            const dup = entries.some((other, oi) => oi !== idx && (other[f.key] || "").trim().toLowerCase() === v.toLowerCase());
            if (dup) toast(`Heads up — "${v}" is already in this list.`);
          }
          saveProfile(); onChange && onChange(); refreshCompleteness();
          if (needsRedraw) redraw();
        });
        grid.appendChild(inp);
      });
      card.appendChild(grid);

      const descField = fieldDefs.find(f => f.type === "textarea");
      if (descField) {
        const ta = document.createElement("textarea");
        ta.rows = 2;
        ta.placeholder = descField.label;
        ta.value = entry[descField.key] || "";
        ta.addEventListener("blur", () => { entry[descField.key] = ta.value.trim(); saveProfile(); refreshCompleteness(); });
        card.appendChild(ta);
      }
      container.appendChild(card);
    });
  }
  redraw();
  return redraw;
}

let experienceHooks = null;
function initExperience() {
  const redraw = renderEntityList(profile.experience, "experience-list", [
    { key: "title", label: "Job title" },
    { key: "company", label: "Company", registryKind: "company", datalistId: "company-suggestions" },
    { key: "company_industry", label: "Industry…", type: "select", options: INDUSTRY_LIST },
    { key: "employment_type", label: "Employment type…", type: "select", options: EMPLOYMENT_TYPES },
    { key: "seniority", label: "Seniority…", type: "select", options: SENIORITY_LEVELS },
    { key: "location_city", label: "City", datalistId: "city-suggestions" },
    { key: "location_country", label: "Country" },
    { key: "start", label: "Start", type: "month" },
    { key: "end", label: "End", type: "month", disabledIf: "is_current" },
    { key: "is_current", label: "Current role", type: "checkbox", disablesKey: "end" },
    { key: "description", label: "What did you do? (a couple of bullet points is fine)", type: "textarea" }
  ], "No work experience added yet.", refreshComputedSignals);
  document.getElementById("add-experience").addEventListener("click", () => {
    profile.experience.push({
      id: nextId(), title: "", company: "", company_industry: "", employment_type: "",
      seniority: "", location_city: "", location_country: "", start: "", end: "",
      is_current: false, description: ""
    });
    saveProfile(); redraw(); refreshCompleteness();
  });
  experienceHooks = { redraw };
}

let educationHooks = null;
function initEducation() {
  const redraw = renderEntityList(profile.education, "education-list", [
    { key: "institution", label: "Institution", registryKind: "institution", datalistId: "institution-suggestions" },
    { key: "institution_type", label: "Institution type…", type: "select", options: INSTITUTION_TYPES },
    { key: "degree_type", label: "Degree type…", type: "select", options: DEGREE_TYPES },
    { key: "field_of_study", label: "Field of study" },
    { key: "gpa", label: "GPA" },
    { key: "gpa_scale", label: "GPA scale…", type: "select", options: GPA_SCALES },
    { key: "start", label: "Start year" },
    { key: "end", label: "End year (or expected)" }
  ], "No education added yet.");
  document.getElementById("add-education").addEventListener("click", () => {
    profile.education.push({
      id: nextId(), institution: "", institution_type: "", degree_type: "", field_of_study: "",
      gpa: "", gpa_scale: "", start: "", end: ""
    });
    saveProfile(); redraw(); refreshCompleteness();
  });
  educationHooks = { redraw };
}

function initSkills() {
  const redraw = renderEntityList(profile.skills, "skills-list", [
    { key: "name", label: "Skill name", dedupeSiblings: true },
    { key: "category", label: "Category…", type: "select", options: SKILL_CATEGORIES },
    { key: "proficiency", label: "Proficiency…", type: "select", options: PROFICIENCY_LEVELS },
    { key: "years_experience", label: "Years of experience" }
  ], "No skills added yet.");
  document.getElementById("add-skill").addEventListener("click", () => {
    profile.skills.push({ id: nextId(), name: "", category: "", proficiency: "", years_experience: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initLanguages() {
  const redraw = renderEntityList(profile.languages, "languages-list", [
    { key: "language", label: "Language", datalistId: "language-suggestions", dedupeSiblings: true },
    { key: "proficiency", label: "Proficiency (CEFR)…", type: "select", options: LANGUAGE_PROFICIENCY }
  ], "No languages added yet.");
  document.getElementById("add-language").addEventListener("click", () => {
    profile.languages.push({ id: nextId(), language: "", proficiency: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initCertifications() {
  const redraw = renderEntityList(profile.certifications, "certifications-list", [
    { key: "name", label: "Certification name", dedupeSiblings: true },
    { key: "issuer", label: "Issuer (e.g. AWS, Google)" },
    { key: "date", label: "Date", type: "month" },
    { key: "credential_id", label: "Credential ID (optional)" }
  ], "No certifications added yet.");
  document.getElementById("add-certification").addEventListener("click", () => {
    profile.certifications.push({ id: nextId(), name: "", issuer: "", date: "", credential_id: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initExtracurriculars() {
  const redraw = renderEntityList(profile.background.extracurriculars, "extracurricular-list", [
    { key: "name", label: "Activity / organization" },
    { key: "role", label: "Your role" },
    { key: "description", label: "Description", type: "textarea" }
  ], "No extracurriculars added yet.");
  document.getElementById("add-extracurricular").addEventListener("click", () => {
    profile.background.extracurriculars.push({ id: nextId(), name: "", role: "", description: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initDocuments() {
  const redraw = renderEntityList(profile.documents, "documents-list", [
    { key: "title", label: "Title (e.g. \"Cover letter — Google BA intern\")" },
    { key: "doc_type", label: "Type…", type: "select", options: DOCUMENT_TYPES },
    { key: "content", label: "Full text — paste or write it here", type: "textarea" }
  ], "No documents saved yet.");
  document.getElementById("add-document").addEventListener("click", () => {
    profile.documents.push({ id: nextId(), title: "", doc_type: "", content: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initNotes() {
  const container = document.getElementById("notes-list");
  function redraw() {
    container.innerHTML = "";
    if (!profile.context_notes.length) {
      const p = document.createElement("p");
      p.className = "empty-state";
      p.textContent = "No notes added yet.";
      container.appendChild(p);
      return;
    }
    profile.context_notes.forEach((note, idx) => {
      const card = document.createElement("div");
      card.className = "entry-card";
      const head = document.createElement("div");
      head.className = "entry-head";
      const labelInput = document.createElement("input");
      labelInput.type = "text";
      labelInput.placeholder = "Label (e.g. \"Old CV bullet points\")";
      labelInput.value = note.label || "";
      labelInput.style.fontWeight = "600";
      labelInput.addEventListener("blur", () => { note.label = labelInput.value.trim(); saveProfile(); });
      const rm = document.createElement("button");
      rm.className = "btn small ghost";
      rm.type = "button"; rm.textContent = "Remove";
      rm.addEventListener("click", () => { profile.context_notes.splice(idx, 1); saveProfile(); redraw(); });
      head.appendChild(labelInput); head.appendChild(rm);
      card.appendChild(head);
      const ta = document.createElement("textarea");
      ta.rows = 3;
      ta.placeholder = "Paste or write the note here";
      ta.value = note.text || "";
      ta.addEventListener("blur", () => { note.text = ta.value.trim(); saveProfile(); });
      card.appendChild(ta);
      container.appendChild(card);
    });
  }
  redraw();
  document.getElementById("add-note").addEventListener("click", () => {
    profile.context_notes.push({ id: nextId(), label: "", text: "" });
    saveProfile(); redraw();
  });
  return redraw;
}

/* ---------------------------------------------------------------------
 * CV / LinkedIn paste → keyword suggestions + auto-saved context note
 * ------------------------------------------------------------------- */

function scanCvText(text) {
  const lower = text.toLowerCase();
  return { roles: [...new Set(ROLE_KEYWORDS.filter(k => lower.includes(k)))] };
}

/* ---------------------------------------------------------------------
 * Heuristic experience/education block detection in pasted CV text.
 * Deterministic pattern matching, not real parsing: a line containing a
 * date range starts a new candidate entry; following non-date lines are
 * appended as details until the next date range or the text ends. Never
 * guesses a title/company split (too easy to get backwards) — the whole
 * headline lands in one field and the user edits from there. Nothing is
 * added to the profile until the user clicks a suggestion card.
 * ------------------------------------------------------------------- */

const MONTH_MAP = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const DATE_RANGE_RE = /((?:[A-Za-z]{3,9}\.?\s+\d{4})|\d{4})\s*(?:[-–—]|to)\s*((?:[A-Za-z]{3,9}\.?\s+\d{4})|\d{4}|present|current|now)/i;
const EDUCATION_HINT_RE = /university|college|bachelor|master|phd|b\.sc|m\.sc|mba|degree|gpa|bootcamp/i;

function parseMonthYear(str) {
  const s = (str || "").trim().toLowerCase();
  if (!s) return "";
  if (/present|current|now/.test(s)) return "present";
  let m = /([a-z]{3,9})\.?\s+(\d{4})/.exec(s);
  if (m && MONTH_MAP[m[1].slice(0, 3)]) return `${m[2]}-${String(MONTH_MAP[m[1].slice(0, 3)]).padStart(2, "0")}`;
  m = /^(\d{4})$/.exec(s);
  if (m) return `${m[1]}-01`;
  return "";
}

/* Words that show up constantly in CV lines but aren't a company,
   university, or city — matching these against the registries would be
   a false positive waiting to happen (e.g. "Lead" at 4 characters is
   within fuzzy-match distance of any number of unrelated 4-6 char
   company names). Skipped before any registry lookup is even
   attempted. Built from taxonomies already in the app, not hardcoded
   from scratch. */
const CV_SECTION_HEADINGS = [
  "education", "experience", "work experience", "professional experience", "skills",
  "projects", "certifications", "languages", "summary", "profile", "activities",
  "extracurriculars", "extracurricular activities", "awards", "honors", "honours",
  "references", "publications", "volunteering", "interests"
];
const CV_TOKEN_STOPWORDS = new Set(
  [].concat(SENIORITY_LEVELS, EMPLOYMENT_TYPES, WORK_MODE_OPTIONS, DEGREE_TYPES, LEVELS, CV_SECTION_HEADINGS)
    .map(s => s.toLowerCase())
);

/* Splits a block's candidate lines into structured fields by checking
   each segment against the real registries (the same ones the rest of
   the app uses) instead of guessing from line position. A segment that
   matches a real university becomes the institution, one that matches
   a real company becomes the company, one that matches a real city
   becomes the location — whatever's left over is the title. This is
   what actually distinguishes a city from a school from a job title;
   the old version just concatenated every line into one blob field.
   Exact matches are always trusted; fuzzy matches only kick in for
   longer tokens (>=6 chars) to keep short/common words from
   accidentally matching an unrelated registry entry. */
function splitCvSegments(lines) {
  const tokens = [];
  lines.forEach(line => {
    line.split(/[,|]| at | @ | – | — | - /i).forEach(seg => {
      const t = seg.trim().replace(/^[-–—•*]\s*/, "").replace(/[()]/g, "").trim();
      if (t && t.length > 1) tokens.push(t);
    });
  });

  function registryMatch(token, list, keyFn, prefixIndex) {
    if (!list.length) return null;
    const lower = token.toLowerCase();
    const exact = list.find(item => (keyFn(item) || "").toLowerCase() === lower);
    if (exact) return exact;
    if (token.length < 6) return null; // fuzzy only for longer, less ambiguous tokens
    const r = normalizeAgainstRegistry(token, list, keyFn, prefixIndex);
    return r.matched ? r.entry : null;
  }

  let institution = "", company = "", location_city = "", location_country = "";
  const leftover = [];
  const knownCountries = new Set(LOCATIONS.map(l => l.country.toLowerCase()));

  tokens.forEach(t => {
    if (CV_TOKEN_STOPWORDS.has(t.toLowerCase())) return;
    if (!institution) {
      const hit = registryMatch(t, UNIVERSITIES, u => u.name, universitiesIndex);
      if (hit) { institution = hit.name; return; }
    }
    if (!company) {
      const hit = registryMatch(t, COMPANIES, c => c.name, companiesIndex);
      if (hit) { company = hit.name; return; }
    }
    if (!location_city) {
      const hit = registryMatch(t, LOCATIONS, l => l.city, null) || registryMatch(t, LOCATIONS, l => l.display, null);
      if (hit) { location_city = hit.city; location_country = hit.country; return; }
    }
    if (knownCountries.has(t.toLowerCase())) {
      // Already covered by a city match above (e.g. "Milan" already set
      // location_country to "Italy") — drop the redundant token instead
      // of letting it fall through to leftover/title.
      if (!location_country) location_country = t;
      return;
    }
    leftover.push(t);
  });

  return { institution, company, location_city, location_country, title: leftover.join(", ") };
}

/* A bullet-marked line, a long sentence, or one ending in punctuation
   reads as a description of what someone DID, not a title/org/location
   line — those are short and unpunctuated. This distinction is what
   lets pendingLines keep collecting the NEXT entry's header lines even
   while a block is still open collecting the CURRENT entry's details;
   without it, every line between two date ranges gets swallowed as the
   first entry's details, including the second entry's own title and
   company — which is the actual bug behind "can't tell a city from a
   job": the block boundary, not the registry matching. */
function looksLikeDetailLine(line) {
  return /^[•\-*]\s/.test(line) || line.length > 70 || /[.!?]$/.test(line);
}

/* A CV's top block — name, phone, email, LinkedIn/portfolio URL — is
   contact info, never a job title, company, or school. Without
   filtering it out here it ends up as pendingLines material for
   whatever entry comes first, polluting its title with a phone number
   or a LinkedIn handle (the exact complaint: "it considered my header
   as something while its just my name and linkedin and number"). */
function looksLikeContactLine(line, isFirstContentLine) {
  if (/@/.test(line)) return true; // email
  if (/(linkedin\.com|github\.com|https?:\/\/|www\.)/i.test(line)) return true; // URL / social profile
  if (/(\+?\d[\d\s().-]{7,}\d)/.test(line)) return true; // phone-number-shaped run of digits
  // A short, plain, title-case line with no digits and nothing entry-like
  // about it, appearing before ANY real content — almost certainly just
  // the candidate's name at the very top of the document.
  if (isFirstContentLine && line.split(/\s+/).length <= 5 && !/\d/.test(line) && !DATE_RANGE_RE.test(line)) return true;
  return false;
}

function scanCvBlocks(text) {
  // Blank lines are treated as hard boundaries between entries (very common
  // in pasted CV/LinkedIn text, though PDF-extracted text often has none —
  // looksLikeDetailLine() above is what carries the real weight there).
  const rawLines = text.split(/\n/).map(l => l.trim());
  const results = [];
  let current = null;
  let pendingLines = [];
  let sawContentLine = false;
  function closeCurrent() { if (current) { results.push(current); current = null; } }

  rawLines.forEach(line => {
    if (!line) { closeCurrent(); pendingLines = []; return; }
    if (looksLikeContactLine(line, !sawContentLine)) { sawContentLine = true; return; }
    sawContentLine = true;
    const m = DATE_RANGE_RE.exec(line);
    if (m) {
      closeCurrent();
      const start = parseMonthYear(m[1]);
      const endRaw = m[2];
      const end = /present|current|now/i.test(endRaw) ? "present" : parseMonthYear(endRaw);
      const remainder = line.replace(m[0], "").replace(/[-–—,•|]+\s*$/, "").trim();
      const segmentLines = remainder ? pendingLines.concat(remainder) : pendingLines;
      const split = splitCvSegments(segmentLines);
      const isEducation = EDUCATION_HINT_RE.test(line) || pendingLines.some(l => EDUCATION_HINT_RE.test(l)) || !!split.institution;
      current = { type: isEducation ? "education" : "work", ...split, start, end, details: "" };
      if (!current.title) current.title = pendingLines.join(" ") || remainder || line;
      pendingLines = [];
    } else if (looksLikeDetailLine(line) && current) {
      current.details = (current.details ? current.details + " " : "") + line.replace(/^[•\-*]\s*/, "");
    } else {
      pendingLines.push(line);
      if (pendingLines.length > 4) pendingLines.shift();
    }
  });
  closeCurrent();
  return results.slice(0, 12);
}

function addSuggestedEntry(block) {
  if (block.type === "education") {
    profile.education.push({
      id: nextId(), institution: block.institution || block.company || block.title, institution_type: "", degree_type: "",
      field_of_study: block.institution ? block.title : "", gpa: "", gpa_scale: "",
      start: block.start === "present" ? "" : block.start,
      end: block.end === "present" ? "" : block.end
    });
    saveProfile();
    if (educationHooks) educationHooks.redraw();
  } else {
    profile.experience.push({
      id: nextId(), title: block.title || block.company, company: block.company, company_industry: "",
      employment_type: "", seniority: "", location_city: block.location_city, location_country: block.location_country,
      start: block.start === "present" ? "" : block.start,
      end: block.end === "present" ? "" : block.end,
      is_current: block.end === "present", description: block.details
    });
    saveProfile();
    if (experienceHooks) experienceHooks.redraw();
  }
  refreshCompleteness();
}

function runCvScan(text, notesRedraw) {
    if (!text) { toast("Nothing to scan."); return; }
    const found = scanCvText(text);
    const blocks = scanCvBlocks(text).filter(b => {
      const orgKey = (b.institution || b.company || "").trim().toLowerCase();
      const titleKey = (b.title || "").trim().toLowerCase();
      if (!orgKey && !titleKey) return false;
      return b.type === "education"
        ? !profile.education.some(e => (e.institution || "").trim().toLowerCase() === orgKey && orgKey)
        : !profile.experience.some(e => (e.title || "").trim().toLowerCase() === titleKey && titleKey);
    });
    const box = document.getElementById("cv-suggestions");
    box.innerHTML = "";
    let any = false;

    if (found.roles.length) {
      any = true;
      const group = document.createElement("div");
      group.className = "suggestion-group";
      const h4 = document.createElement("h4");
      h4.textContent = "Roles we spotted — click to add";
      group.appendChild(h4);
      found.roles.forEach(word => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "check-chip";
        btn.textContent = word;
        btn.addEventListener("click", () => {
          if (!profile.preferences.roles.value.includes(word)) profile.preferences.roles.value.push(word);
          saveProfile();
          if (rolesHooks) { rolesHooks.redraw(); rolesHooks.refresh(); }
          btn.disabled = true;
        });
        group.appendChild(btn);
      });
      box.appendChild(group);
    }

    if (blocks.length) {
      any = true;
      const group = document.createElement("div");
      group.className = "suggestion-group";
      const h4 = document.createElement("h4");
      h4.textContent = "Experience & education entries we spotted — review before adding";
      group.appendChild(h4);
      blocks.forEach(block => {
        const card = document.createElement("div");
        card.className = "entry-card";
        const strong = document.createElement("div");
        strong.style.fontWeight = "600";
        strong.textContent = block.title || block.institution || block.company || "(untitled)";
        const meta = document.createElement("p");
        meta.className = "muted";
        meta.style.margin = "2px 0 8px";
        // institution/company are only ever set by splitCvSegments() on an
        // actual registry match, never guessed — so their presence here
        // is itself the "verified" signal, not something to compute again.
        const org = block.institution || block.company;
        const loc = [block.location_city, block.location_country].filter(Boolean).join(", ");
        const dateText = (block.start || block.end) ? [block.start, block.end].filter(Boolean).join(" – ") : "dates not detected";
        meta.textContent = [
          block.type === "education" ? "Education" : "Work experience",
          org ? `${org} (verified)` : "",
          loc, dateText
        ].filter(Boolean).join(" • ");
        const actions = document.createElement("div");
        actions.className = "actions";
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn small secondary";
        addBtn.textContent = block.type === "education" ? "Add as education" : "Add as work experience";
        addBtn.addEventListener("click", () => {
          addSuggestedEntry(block);
          card.remove();
          toast("Added — review and fill in the rest below.");
        });
        const dismissBtn = document.createElement("button");
        dismissBtn.type = "button";
        dismissBtn.className = "btn small ghost";
        dismissBtn.textContent = "Not relevant";
        dismissBtn.addEventListener("click", () => card.remove());
        actions.appendChild(addBtn);
        actions.appendChild(dismissBtn);
        card.appendChild(strong);
        card.appendChild(meta);
        card.appendChild(actions);
        group.appendChild(card);
      });
      box.appendChild(group);
    }

    if (!any) {
      box.innerHTML = "<p class=\"muted\">Nothing obvious matched — that's fine, add entries manually below.</p>";
    }
    box.classList.remove("hidden");

    if (!profile.context_notes.some(n => n.label === "CV text (uploaded or pasted)")) {
      profile.context_notes.push({ id: nextId(), label: "CV text (uploaded or pasted)", text });
      saveProfile();
      notesRedraw();
    }
}

function initCvScan(notesRedraw) {
  document.getElementById("cv-scan-btn").addEventListener("click", () => {
    runCvScan(document.getElementById("cv-paste").value.trim(), notesRedraw);
  });

  document.getElementById("cv-paste-toggle").addEventListener("click", () => {
    document.getElementById("cv-paste").classList.remove("hidden");
    document.getElementById("cv-paste-actions").classList.remove("hidden");
    document.getElementById("cv-paste").focus();
  });

  const uploadInput = document.getElementById("cv-upload-file");
  document.getElementById("cv-upload-btn").addEventListener("click", () => uploadInput.click());
  uploadInput.addEventListener("change", async () => {
    const file = uploadInput.files[0];
    uploadInput.value = "";
    if (!file) return;
    const status = document.getElementById("cv-upload-status");
    status.textContent = `Reading ${file.name}…`;
    try {
      let text;
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        if (!window.extractPdfText) throw new Error("PDF reader didn't load");
        text = await window.extractPdfText(file);
      } else {
        text = await file.text();
      }
      text = text.trim();
      if (!text) { status.textContent = `Couldn't find any text in ${file.name} — it may be a scanned image rather than a text-based PDF. Try "Paste text instead".`; return; }
      document.getElementById("cv-paste").value = text;
      status.textContent = `Read ${file.name} (${text.length.toLocaleString()} characters) — scanning…`;
      runCvScan(text, notesRedraw);
      status.textContent = `Read ${file.name} — see suggestions below.`;
    } catch (e) {
      status.textContent = `Couldn't read ${file.name} (${e.message}). Try "Paste text instead".`;
    }
  });
}

/* ---------------------------------------------------------------------
 * Computed signals + completeness score
 * ------------------------------------------------------------------- */

function refreshComputedSignals() {
  // Recomputed on demand (e.g. before export); nothing to render inline
  // for these right now beyond what refreshCompleteness() already shows.
}

function computeCompleteness() {
  const p = profile;
  const checks = [
    p.preferences.roles.source !== "open",
    p.preferences.levels.source !== "open",
    p.preferences.locations.source !== "open",
    p.preferences.pay_floor.source !== "open",
    p.preferences.availability.source !== "open",
    !!p.mobility.current_city,
    !!p.mobility.work_authorization,
    !!p.mobility.work_mode,
    p.experience.some(e => e.title && e.company),
    p.education.some(e => e.institution && e.degree_type),
    p.skills.length > 0,
    p.languages.length > 0,
    !!p.links.linkedin,
    !!p.job_search_status,
    p.interests.length > 0,
    p.documents.length > 0
  ];
  const filled = checks.filter(Boolean).length;
  return Math.round((filled / checks.length) * 100);
}

function refreshCompleteness() {
  const pct = computeCompleteness();
  document.getElementById("completeness-pct").textContent = pct + "%";
  document.getElementById("completeness-fill").style.width = pct + "%";
  const hint = document.getElementById("completeness-hint");
  if (pct === 100) hint.textContent = "Everything a matcher would want is filled in.";
  else if (pct >= 60) hint.textContent = "Good shape — a few structured fields are still open.";
  else hint.textContent = "Fill in more structured fields (not just the summary) to make this usable for matching.";
}

/* ---------------------------------------------------------------------
 * Summary (headline + story) — template-generated draft.
 *
 * NOTE: deterministic stand-in, not a real model call — see the note
 * left for the team: a static page can't safely hold an API key, and
 * standing up a backend for this is real infra/cost, out of scope while
 * we're validating the data structure itself. Swap this function's body
 * for an actual API call once the schema above is settled.
 * ------------------------------------------------------------------- */

function synthesizeSummary() {
  const p = profile.preferences;
  function isFieldEmpty(key) {
    const v = p[key].value;
    if (Array.isArray(v)) return v.length === 0;
    if (v && typeof v === "object") return Object.values(v).every(x => !x);
    return !v;
  }
  const filled = key => p[key].source !== "open" && !isFieldEmpty(key);
  const qualifier = key => (p[key].source === "lean" ? "possibly " : "");
  const asText = key => Array.isArray(p[key].value) ? p[key].value.join(" / ") : p[key].value;

  const totalYears = computeTotalYearsExperience(profile.experience);
  const inferredSeniority = inferSeniority(totalYears);

  const any = ["roles", "levels", "locations", "industries"].some(k => filled(k)) || profile.experience.length;
  if (!any) {
    profile.headline = { value: "A profile just getting started.", source: "lean", evidence: "Not enough filled in yet to summarize." };
    profile.story = { value: "Most fields are still open — fill in what you know and regenerate any time.", source: "lean", evidence: "" };
    return;
  }

  let headlineParts = [];
  if (totalYears > 0) headlineParts.push(`${inferredSeniority}`);
  if (filled("roles")) headlineParts.push(`${qualifier("roles")}${asText("roles")}`);
  else if (filled("levels")) headlineParts.push(`(${asText("levels")})`);
  let headline = headlineParts.join(" ");
  if (filled("locations")) headline += ` — open to ${asText("locations")}`;
  headline = (headline.trim() || "A profile taking shape.");
  headline = headline.charAt(0).toUpperCase() + headline.slice(1);

  let sentences = [];
  if (totalYears > 0) sentences.push(`About ${totalYears} year${totalYears === 1 ? "" : "s"} of experience (${inferredSeniority} level).`);
  if (filled("roles")) sentences.push(`Looking for ${qualifier("roles")}${asText("roles")} roles${filled("levels") ? ` at the ${qualifier("levels")}${asText("levels")} level` : ""}.`);
  if (filled("industries")) sentences.push(`Interested in ${qualifier("industries")}${asText("industries")}.`);
  if (filled("locations")) sentences.push(`Open to ${qualifier("locations")}${asText("locations")}.`);
  if (profile.mobility.work_mode) sentences.push(`Work mode preference: ${profile.mobility.work_mode}.`);
  if (p.pay_floor.value.bracket) sentences.push(`Pay floor around ${p.pay_floor.value.bracket} ${p.pay_floor.value.currency}/${p.pay_floor.value.period}.`);
  if (p.availability.value.flexibility) sentences.push(`Availability: ${p.availability.value.flexibility}${p.availability.value.earliest_date ? `, earliest ${p.availability.value.earliest_date}` : ""}.`);
  if (filled("dealbreakers")) sentences.push(`Hard no on: ${asText("dealbreakers")}.`);
  if (profile.skills.length) sentences.push(`Key skills: ${profile.skills.slice(0, 5).map(s => s.name).filter(Boolean).join(", ")}.`);
  if (profile.languages.length) sentences.push(`Languages: ${profile.languages.map(l => `${l.language}${l.proficiency ? ` (${l.proficiency})` : ""}`).filter(l => l.trim()).join(", ")}.`);
  if (profile.interests.length) sentences.push(`Outside of work: ${profile.interests.map(i => i.value).join(", ")}.`);

  const cvNote = profile.context_notes.find(n => n.label === "Pasted CV / LinkedIn text");
  if (cvNote && cvNote.text) {
    const firstSentence = cvNote.text.split(/(?<=[.!?])\s/)[0];
    if (firstSentence && firstSentence.length < 200) sentences.unshift(firstSentence.trim());
  }

  const usedLean = ["roles", "levels", "locations", "industries"].some(k => p[k].source === "lean" && filled(k));
  profile.headline = { value: headline, source: "lean", evidence: "Template-composed from the fields you filled in." };
  profile.story = { value: sentences.join(" "), source: usedLean ? "lean" : "stated", evidence: usedLean ? "Includes fields you're still leaning on." : "" };
}

function growTextarea(el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; }

function renderSummary() {
  const headlineEl = document.getElementById("headline-text");
  headlineEl.value = profile.headline.value;
  document.getElementById("story-text").value = profile.story.value;
  const badgeHost = document.getElementById("headline-badge");
  badgeHost.innerHTML = "";
  badgeHost.appendChild(badgeEl(profile.headline.source));
  growTextarea(headlineEl);
}

function initSummary() {
  const headlineInput = document.getElementById("headline-text");
  const storyInput = document.getElementById("story-text");
  headlineInput.addEventListener("input", () => growTextarea(headlineInput));
  headlineInput.addEventListener("blur", () => {
    profile.headline.value = headlineInput.value.trim();
    profile.headline.source = profile.headline.value ? "stated" : "open";
    renderSummary();
    saveProfile();
  });
  storyInput.addEventListener("blur", () => {
    profile.story.value = storyInput.value.trim();
    profile.story.source = profile.story.value ? "stated" : "open";
    saveProfile();
  });
  document.getElementById("regen-btn").addEventListener("click", () => {
    synthesizeSummary();
    renderSummary();
    saveProfile();
    toast("Summary regenerated from your current answers.");
  });
}

/* ---------------------------------------------------------------------
 * Export & reset
 * ------------------------------------------------------------------- */

function exportProfile() {
  const totalYears = computeTotalYearsExperience(profile.experience);
  const exportObj = Object.assign({}, profile, {
    computed: {
      total_years_experience: totalYears,
      inferred_seniority: inferSeniority(totalYears),
      completeness_score: computeCompleteness()
    }
  });
  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "profile.json";
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  toast("profile.json downloaded");
}

/* Loads a previously-exported profile.json back in — the repeatable
   "update my profile" path: re-import after editing the file elsewhere,
   restore on a new device/browser, or bring in a profile someone else
   built with this same tool. Deep-merges onto emptyProfile() the same
   way the normal page-load path does, then revalidates every enum
   field against taxonomies.js so nothing foreign or stale sneaks in.
   Replaces the current profile outright (with confirmation) rather
   than attempting a field-by-field merge — a partial/silent merge of
   two different profiles is far more likely to produce a confusing
   Frankenstein profile than a clean, explicit replace. */
function importProfile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    let incoming;
    try { incoming = JSON.parse(reader.result); }
    catch (e) { toast("That file isn't valid JSON — import cancelled."); return; }
    if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.experience)) {
      toast("Doesn't look like a profile.json from this tool — import cancelled.");
      return;
    }
    if (!confirm("This replaces everything currently in the form with the imported file. Continue?")) return;
    delete incoming.computed; // export-only, not part of the editable schema
    profile = revalidateProfile(Object.assign(emptyProfile(), incoming, {
      mobility: Object.assign(emptyProfile().mobility, incoming.mobility || {}),
      links: Object.assign(emptyProfile().links, incoming.links || {}),
      preferences: Object.assign(emptyProfile().preferences, incoming.preferences || {}),
      background: Object.assign(emptyProfile().background, incoming.background || {})
    }));
    saveProfile();
    toast("Profile imported — reloading…");
    setTimeout(() => location.reload(), 600);
  };
  reader.onerror = () => toast("Couldn't read that file.");
  reader.readAsText(file);
}

function initFooter() {
  document.getElementById("export-btn").addEventListener("click", exportProfile);
  const importInput = document.getElementById("import-file");
  document.getElementById("import-btn").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => {
    if (importInput.files[0]) importProfile(importInput.files[0]);
    importInput.value = "";
  });
  document.getElementById("restart-btn").addEventListener("click", () => {
    if (!confirm("This clears everything you've entered. Continue?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

/* Idempotent on purpose: called once at startup with the small
   immediate fallbacks (so the datalists aren't empty during the brief
   window before the real registry loads), then called again once
   loadRegistry() resolves — clearing first means the second call
   replaces rather than duplicates the options. */
function populateDatalists() {
  const fill = (id, list) => {
    const el = document.getElementById(id);
    el.innerHTML = "";
    list.forEach(v => { const o = document.createElement("option"); o.value = v; el.appendChild(o); });
  };
  fill("role-suggestions", ROLE_KEYWORDS);
  fill("language-suggestions", COMMON_LANGUAGES);
  fill("city-suggestions", LOCATIONS.length ? LOCATIONS.map(l => l.display) : CITY_SUGGESTIONS);
  fill("institution-suggestions", UNIVERSITIES.length ? UNIVERSITIES.map(u => u.name) : INSTITUTION_SEED);
  fill("company-suggestions", COMPANIES.length ? COMPANIES.map(c => c.name) : COMPANY_SEED);
}

/* Guarded: this file is also require()'d from tests/ under Node, where
   there's no `document` to attach to and no page lifecycle to run. */
if (typeof document !== "undefined") {
document.addEventListener("DOMContentLoaded", () => {
  const saved = loadProfile();
  if (saved) profile = revalidateProfile(Object.assign(emptyProfile(), saved, {
    mobility: Object.assign(emptyProfile().mobility, saved.mobility || {}),
    links: Object.assign(emptyProfile().links, saved.links || {}),
    preferences: Object.assign(emptyProfile().preferences, saved.preferences || {}),
    background: Object.assign(emptyProfile().background, saved.background || {})
  }));

  populateDatalists();
  renderRoles();
  renderLevels();
  renderLocations();
  renderAvailability();
  renderIndustries();
  renderCompanies();
  renderPay();
  renderDealbreakers();
  renderInterests();
  initMobility();
  initLinksAndStatus();
  initExperience();
  initEducation();
  initSkills();
  initLanguages();
  initCertifications();
  initExtracurriculars();
  initDocuments();
  const notesRedraw = initNotes();
  initCvScan(notesRedraw);
  renderSummary();
  initSummary();
  initFooter();
  refreshCompleteness();

  // Real registries load async and take a moment; the form is fully
  // usable before this resolves, it just verifies/datalist-completes
  // once the real data is in. See registry.js.
  loadRegistry().then(() => {
    universitiesIndex = buildPrefixIndex(UNIVERSITIES, u => u.name);
    companiesIndex = buildPrefixIndex(COMPANIES, c => c.name);
    populateDatalists();
    if (locationsHooks) locationsHooks.redraw();
    if (UNIVERSITIES.length || COMPANIES.length) {
      toast(`Loaded ${UNIVERSITIES.length.toLocaleString()} universities, ${COMPANIES.length.toLocaleString()} companies, ${LOCATIONS.length} locations.`);
    }
  });
});
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { scanCvBlocks, splitCvSegments, looksLikeDetailLine };
}
