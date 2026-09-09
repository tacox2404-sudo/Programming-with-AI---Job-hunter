"use strict";

/* ---------------------------------------------------------------------
 * Job Search Profile Builder — single-page editor.
 *
 * v2: replaces the one-question-at-a-time chat wizard with a flat form
 * so people can fill fields in any order at their own pace. Free-text
 * risk fields (location, pay) are now standardized pickers so a typo or
 * a stray digit can't silently corrupt the data. Adds background
 * (education/experience/extracurriculars) and free-form context notes
 * so there's enough material here to eventually draft a CV or cover
 * letter from. The profile summary is still template-generated, not a
 * real model call — see synthesizeSummary() for where that would plug
 * in once this structure is validated.
 * ------------------------------------------------------------------- */

const STORAGE_KEY = "jobHunterProfile.v2";

const LEVELS = ["Internship", "Graduate scheme / trainee", "Entry-level", "Junior", "Associate", "Other"];

const CITY_SUGGESTIONS = [
  "Remote", "New York, USA", "San Francisco, USA", "London, UK", "Berlin, Germany",
  "Amsterdam, Netherlands", "Paris, France", "Dublin, Ireland", "Toronto, Canada",
  "Singapore", "Sydney, Australia", "Madrid, Spain", "Lisbon, Portugal", "Barcelona, Spain",
  "Zurich, Switzerland", "Stockholm, Sweden", "Tokyo, Japan", "Dubai, UAE",
  "Bangalore, India", "São Paulo, Brazil"
];

const INDUSTRY_LIST = [
  "Technology / Software", "Fintech", "Banking & Finance", "Healthcare", "Education",
  "E-commerce & Retail", "Manufacturing", "Consulting", "Non-profit", "Government",
  "Media & Entertainment", "Gaming", "Logistics", "Energy", "Insurance", "Telecom",
  "Pharma & Biotech"
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

const ROLE_KEYWORDS = [
  "software engineer", "data analyst", "data scientist", "product manager",
  "marketing", "sales", "business analyst", "financial analyst", "accountant",
  "designer", "ux designer", "consultant", "operations", "project manager",
  "customer success", "hr", "human resources", "recruiter", "researcher",
  "teacher", "nurse", "engineer", "developer", "analyst"
];

function emptyProfile() {
  return {
    headline: { value: "", source: "open", evidence: "" },
    story: { value: "", source: "open", evidence: "" },
    interests: [],
    preferences: {
      roles: { value: [], source: "open", evidence: "" },
      levels: { value: [], source: "open", evidence: "" },
      locations: { value: [], source: "open", evidence: "" },
      remote_relocate: { value: [], source: "open", evidence: "" },
      work_authorization: { value: "", detail: "", source: "open", evidence: "" },
      availability: { value: { earliest_date: "", flexibility: "" }, source: "open", evidence: "" },
      industries: { value: [], source: "open", evidence: "" },
      companies: { value: [], source: "open", evidence: "" },
      pay_floor: { value: { bracket: "", currency: "USD", period: "year" }, source: "open", evidence: "" },
      dealbreakers: { value: [], source: "open", evidence: "" }
    },
    background: { education: [], experience: [], extracurriculars: [] },
    context_notes: []
  };
}

let profile = emptyProfile();
let idSeq = 1;
function nextId() { return "e" + (idSeq++) + "_" + Date.now().toString(36); }

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

/* Wires the shared badge + "just leaning" toggle onto a field's container.
   Call refresh() after the field's own control(s) change. */
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
  }
  leanCb.addEventListener("change", refresh);
  reason.addEventListener("blur", () => { field.evidence = reason.value.trim(); saveProfile(); });
  return refresh;
}

/* ---- Reusable tag input (chips), optionally backed by a <datalist> ----
   Returns a redraw() function so callers can refresh the chips after
   mutating `values` from outside (e.g. a CV-suggestion click). */
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

/* ---- Reusable checkbox-chip group (standardized picks) ---- */
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

/* ---------------------------------------------------------------------
 * Field builders — one per preference, each renders into its #field-*
 * container (label row already present in the HTML) and wires badges.
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

function renderRemote() {
  const host = document.getElementById("field-remote");
  const label = document.createElement("label");
  label.className = "main-label";
  label.style.display = "block";
  label.style.marginBottom = "6px";
  label.textContent = "Remote & relocation";
  host.appendChild(label);
  const field = profile.preferences.remote_relocate;
  buildCheckChips(host, ["Open to remote", "Open to relocate"], field.value, () => {
    field.source = field.value.length ? "stated" : "open";
    saveProfile();
  });
}

function renderWorkAuth() {
  const host = document.getElementById("field-workauth");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.work_authorization;
  const select = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "Select one…";
  select.appendChild(blank);
  WORK_AUTH_OPTIONS.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt; o.textContent = opt;
    if (field.value === opt) o.selected = true;
    select.appendChild(o);
  });
  const detail = document.createElement("input");
  detail.type = "text";
  detail.placeholder = "Detail (optional) — e.g. which visa/permit";
  detail.value = field.detail || "";
  detail.style.marginTop = "6px";
  select.addEventListener("change", () => { field.value = select.value; refresh(); });
  detail.addEventListener("blur", () => { field.detail = detail.value.trim(); saveProfile(); });
  host.appendChild(select);
  host.appendChild(detail);
  const refresh = attachFieldChrome(row, field, () => !field.value);
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
  const flexSelect = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "Flexibility…";
  flexSelect.appendChild(blank);
  FLEXIBILITY_OPTIONS.forEach(opt => {
    const o = document.createElement("option");
    o.value = opt; o.textContent = opt;
    if (field.value.flexibility === opt) o.selected = true;
    flexSelect.appendChild(o);
  });
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
  const presetValues = field.value.filter(v => INDUSTRY_LIST.includes(v));
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
  buildTagInput(host, field.value, () => refresh(), { placeholder: "Company name — Enter to add" });
  const refresh = attachFieldChrome(row, field, () => field.value.length === 0);
  refresh();
}

function renderPay() {
  const host = document.getElementById("field-pay");
  const row = host.querySelector(".field-label-row");
  const field = profile.preferences.pay_floor;
  const wrap = document.createElement("div");
  wrap.className = "row";
  const bracketSelect = document.createElement("select");
  const blank = document.createElement("option");
  blank.value = ""; blank.textContent = "Minimum bracket…";
  bracketSelect.appendChild(blank);
  PAY_BRACKETS.forEach(b => {
    const o = document.createElement("option");
    o.value = b; o.textContent = b;
    if (field.value.bracket === b) o.selected = true;
    bracketSelect.appendChild(o);
  });
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
 * Background: repeatable entry cards (education / experience / extracurriculars)
 * ------------------------------------------------------------------- */

function renderEntryList(listKey, containerId, fields, describeEmpty) {
  const container = document.getElementById(containerId);
  function redraw() {
    container.innerHTML = "";
    const entries = profile.background[listKey];
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
      rm.type = "button";
      rm.textContent = "Remove";
      rm.addEventListener("click", () => { entries.splice(idx, 1); saveProfile(); redraw(); });
      head.appendChild(span); head.appendChild(rm);
      card.appendChild(head);

      const grid = document.createElement("div");
      grid.className = "entry-grid";
      fields.forEach(f => {
        if (f.type === "textarea") return; // rendered separately below
        const inp = document.createElement("input");
        inp.type = f.type || "text";
        inp.placeholder = f.label;
        inp.value = entry[f.key] || "";
        inp.addEventListener("blur", () => { entry[f.key] = inp.value.trim(); saveProfile(); });
        grid.appendChild(inp);
      });
      card.appendChild(grid);
      const descField = fields.find(f => f.type === "textarea");
      if (descField) {
        const ta = document.createElement("textarea");
        ta.rows = 2;
        ta.placeholder = descField.label;
        ta.value = entry[descField.key] || "";
        ta.addEventListener("blur", () => { entry[descField.key] = ta.value.trim(); saveProfile(); });
        card.appendChild(ta);
      }
      container.appendChild(card);
    });
  }
  redraw();
  return redraw;
}

function initBackgroundSections() {
  const eduRedraw = renderEntryList("education", "education-list", [
    { key: "school", label: "School" },
    { key: "degree", label: "Degree" },
    { key: "field", label: "Field of study" },
    { key: "start", label: "Start year" },
    { key: "end", label: "End year (or expected)" }
  ], "No education added yet.");
  document.getElementById("add-education").addEventListener("click", () => {
    profile.background.education.push({ id: nextId(), school: "", degree: "", field: "", start: "", end: "" });
    saveProfile(); eduRedraw();
  });

  const expRedraw = renderEntryList("experience", "experience-list", [
    { key: "title", label: "Title" },
    { key: "org", label: "Organization" },
    { key: "start", label: "Start (mm/yyyy)" },
    { key: "end", label: "End (mm/yyyy or Present)" },
    { key: "description", label: "What did you do? (a couple of bullet points is fine)", type: "textarea" }
  ], "No work experience added yet.");
  document.getElementById("add-experience").addEventListener("click", () => {
    profile.background.experience.push({ id: nextId(), title: "", org: "", start: "", end: "", description: "" });
    saveProfile(); expRedraw();
  });

  const extraRedraw = renderEntryList("extracurriculars", "extracurricular-list", [
    { key: "name", label: "Activity / organization" },
    { key: "role", label: "Your role" },
    { key: "description", label: "Description", type: "textarea" }
  ], "No extracurriculars added yet.");
  document.getElementById("add-extracurricular").addEventListener("click", () => {
    profile.background.extracurriculars.push({ id: nextId(), name: "", role: "", description: "" });
    saveProfile(); extraRedraw();
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
      toast("Saved as a context note too, for later.");
    }
  });
}

/* ---------------------------------------------------------------------
 * Summary (headline + story) — template-generated draft.
 *
 * NOTE: this is a deterministic stand-in, not a real model call. A
 * static page can't safely call an LLM API (no way to hold a key), and
 * that's real infra/cost — out of scope for validating the structure.
 * The hook is here: swap this function's body for an API call once the
 * schema above is settled and a backend exists to make the call from.
 * ------------------------------------------------------------------- */

function synthesizeSummary() {
  const p = profile.preferences;
  const filled = (key, get) => p[key].source !== "open" && !isFieldEmpty(key, get);
  function isFieldEmpty(key) {
    const v = p[key].value;
    if (Array.isArray(v)) return v.length === 0;
    if (v && typeof v === "object") return Object.values(v).every(x => !x);
    return !v;
  }
  const qualifier = key => (p[key].source === "lean" ? "possibly " : "");
  const asText = key => Array.isArray(p[key].value) ? p[key].value.join(" / ") : p[key].value;

  const any = ["roles", "levels", "locations", "industries"].some(k => filled(k));
  if (!any) {
    profile.headline = { value: "A profile just getting started.", source: "lean", evidence: "Not enough filled in yet to summarize." };
    profile.story = { value: "Most fields are still open — fill in what you know and regenerate any time.", source: "lean", evidence: "" };
    return;
  }

  let headlineParts = [];
  if (filled("roles")) headlineParts.push(`${qualifier("roles")}${asText("roles")}`);
  if (filled("levels")) headlineParts.push(`(${asText("levels")})`);
  let headline = headlineParts.join(" ");
  if (filled("locations")) headline += ` — open to ${asText("locations")}`;
  headline = (headline.trim() || "A profile taking shape.");
  headline = headline.charAt(0).toUpperCase() + headline.slice(1);

  let sentences = [];
  if (filled("roles")) sentences.push(`Looking for ${qualifier("roles")}${asText("roles")} roles${filled("levels") ? ` at the ${qualifier("levels")}${asText("levels")} level` : ""}.`);
  if (filled("industries")) sentences.push(`Interested in ${qualifier("industries")}${asText("industries")}.`);
  if (filled("locations")) sentences.push(`Open to ${qualifier("locations")}${asText("locations")}.`);
  if (p.pay_floor.value.bracket) sentences.push(`Pay floor around ${p.pay_floor.value.bracket} ${p.pay_floor.value.currency}/${p.pay_floor.value.period}.`);
  if (p.availability.value.flexibility) sentences.push(`Availability: ${p.availability.value.flexibility}${p.availability.value.earliest_date ? `, earliest ${p.availability.value.earliest_date}` : ""}.`);
  if (filled("dealbreakers")) sentences.push(`Hard no on: ${asText("dealbreakers")}.`);
  if (profile.background.experience.length) {
    const latest = profile.background.experience[profile.background.experience.length - 1];
    if (latest.title) sentences.push(`Most recently: ${latest.title}${latest.org ? ` at ${latest.org}` : ""}.`);
  }
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

function renderSummary() {
  document.getElementById("headline-text").value = profile.headline.value;
  document.getElementById("story-text").value = profile.story.value;
  const badgeHost = document.getElementById("headline-badge");
  badgeHost.innerHTML = "";
  badgeHost.appendChild(badgeEl(profile.headline.source));
}

function initSummary() {
  const headlineInput = document.getElementById("headline-text");
  const storyInput = document.getElementById("story-text");
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
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
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
  const roleList = document.getElementById("role-suggestions");
  ROLE_KEYWORDS.forEach(r => { const o = document.createElement("option"); o.value = r; roleList.appendChild(o); });
  const cityList = document.getElementById("city-suggestions");
  CITY_SUGGESTIONS.forEach(c => { const o = document.createElement("option"); o.value = c; cityList.appendChild(o); });
}

document.addEventListener("DOMContentLoaded", () => {
  const saved = loadProfile();
  if (saved) profile = saved;

  populateDatalists();
  renderRoles();
  renderLevels();
  renderLocations();
  renderRemote();
  renderWorkAuth();
  renderAvailability();
  renderIndustries();
  renderCompanies();
  renderPay();
  renderDealbreakers();
  renderInterests();
  initBackgroundSections();
  const notesRedraw = initNotes();
  initCvScan(notesRedraw);
  renderSummary();
  initSummary();
  initFooter();
});
