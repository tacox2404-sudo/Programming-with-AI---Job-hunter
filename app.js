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
    context_notes: []
  };
}

let profile = emptyProfile();
let idSeq = 1;
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
  const knownList = opts.knownValues ? opts.knownValues.map(v => v.toLowerCase()) : null;

  function redraw() {
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

function renderLocations() {
  const host = document.getElementById("field-locations");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.locations;
  buildTagInput(host, field.value, () => refresh(), { datalistId: "city-suggestions", knownValues: CITY_SUGGESTIONS, placeholder: "Pick or type a city — Enter to add" });
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
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
          if (f.normalizeAgainst) {
            const result = normalizeAgainstList(v, f.normalizeAgainst);
            if (result.matched && result.canonical !== v) {
              v = result.canonical;
              inp.value = v;
              toast(`Normalized to "${v}"`);
            }
          }
          entry[f.key] = v;
          saveProfile(); onChange && onChange(); refreshCompleteness();
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

function initExperience() {
  const redraw = renderEntityList(profile.experience, "experience-list", [
    { key: "title", label: "Job title" },
    { key: "company", label: "Company", normalizeAgainst: COMPANY_SEED, datalistId: "company-suggestions" },
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
}

function initEducation() {
  const redraw = renderEntityList(profile.education, "education-list", [
    { key: "institution", label: "Institution", normalizeAgainst: INSTITUTION_SEED, datalistId: "institution-suggestions" },
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
}

function initSkills() {
  const redraw = renderEntityList(profile.skills, "skills-list", [
    { key: "name", label: "Skill name" },
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
    { key: "language", label: "Language", datalistId: "language-suggestions" },
    { key: "proficiency", label: "Proficiency (CEFR)…", type: "select", options: LANGUAGE_PROFICIENCY }
  ], "No languages added yet.");
  document.getElementById("add-language").addEventListener("click", () => {
    profile.languages.push({ id: nextId(), language: "", proficiency: "" });
    saveProfile(); redraw(); refreshCompleteness();
  });
}

function initCertifications() {
  const redraw = renderEntityList(profile.certifications, "certifications-list", [
    { key: "name", label: "Certification name" },
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

function initCvScan(notesRedraw) {
  document.getElementById("cv-scan-btn").addEventListener("click", () => {
    const text = document.getElementById("cv-paste").value.trim();
    if (!text) { toast("Paste something first."); return; }
    const found = scanCvText(text);
    const box = document.getElementById("cv-suggestions");
    box.innerHTML = "";
    if (found.roles.length) {
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
    } else {
      box.innerHTML = "<p class=\"muted\">Nothing obvious matched — that's fine, add roles manually below.</p>";
    }
    box.classList.remove("hidden");

    if (!profile.context_notes.some(n => n.label === "Pasted CV / LinkedIn text")) {
      profile.context_notes.push({ id: nextId(), label: "Pasted CV / LinkedIn text", text });
      saveProfile();
      notesRedraw();
      toast("Also saved as a context note for later.");
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
    p.interests.length > 0
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

function initFooter() {
  document.getElementById("export-btn").addEventListener("click", exportProfile);
  document.getElementById("restart-btn").addEventListener("click", () => {
    if (!confirm("This clears everything you've entered. Continue?")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });
}

function populateDatalists() {
  const fill = (id, list) => {
    const el = document.getElementById(id);
    list.forEach(v => { const o = document.createElement("option"); o.value = v; el.appendChild(o); });
  };
  fill("role-suggestions", ROLE_KEYWORDS);
  fill("city-suggestions", CITY_SUGGESTIONS);
  fill("institution-suggestions", INSTITUTION_SEED);
  fill("company-suggestions", COMPANY_SEED);
  fill("language-suggestions", COMMON_LANGUAGES);
}

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
  const notesRedraw = initNotes();
  initCvScan(notesRedraw);
  renderSummary();
  initSummary();
  initFooter();
  refreshCompleteness();
});
