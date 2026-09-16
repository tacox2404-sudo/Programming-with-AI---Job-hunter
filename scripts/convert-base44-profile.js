#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * One-off converter: a base44 "career-profile-craft" export -> our
 * profile.json schema (the shape app.js's importProfile() expects).
 *
 * Not part of the repeatable pipelines (Profile Builder / job
 * ingestion) — this exists so a real base44 export can be dropped in
 * once via the Import button instead of re-typed by hand, and to make
 * the schema differences concrete rather than theoretical. Several of
 * base44's own data-quality issues (skills listed twice, spoken and
 * programming languages sharing one "language" category, certifications
 * flattened into skills instead of getting their own issuer/date
 * fields, a cascading preferences[] array that stores each key's array
 * as a superset of the next) are fixed up here, not carried over.
 *
 * Usage: node scripts/convert-base44-profile.js <input.json> [output.json]
 * Prints a report of what was mapped, approximated, or left for the
 * user to fill in by hand — nothing is silently dropped or guessed.
 * ------------------------------------------------------------------- */

const fs = require("fs");
const path = require("path");
const {
  DEGREE_TYPES, EMPLOYMENT_TYPES, SENIORITY_LEVELS, SKILL_CATEGORIES,
  PROFICIENCY_LEVELS, LANGUAGE_PROFICIENCY, COMMON_LANGUAGES, INDUSTRY_LIST,
  PAY_BRACKETS, CURRENCIES, WORK_AUTH_OPTIONS, LEVELS, INSTITUTION_TYPES
} = require("../taxonomies.js");

const COMPANIES_REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "registry", "companies.json"), "utf8"));
const companyIndustryByName = new Map();
COMPANIES_REGISTRY.filter(c => c.industry).forEach(c => {
  companyIndustryByName.set(c.name.toLowerCase(), c.industry);
  (c.aliases || []).forEach(a => companyIndustryByName.set(a.toLowerCase(), c.industry));
});

let idSeq = 1;
function nextId() { return "conv" + (idSeq++); }

const notes = []; // conversion report lines, printed at the end
function report(line) { notes.push(line); }

function emptyProfile() {
  return {
    headline: { value: "", source: "open", evidence: "" },
    story: { value: "", source: "open", evidence: "" },
    interests: [],
    mobility: {
      current_city: "", current_country: "",
      work_authorization: "", work_authorization_detail: "",
      open_to_relocate: false, work_mode: ""
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
    experience: [], education: [], skills: [], languages: [], certifications: [],
    background: { extracurriculars: [] }, context_notes: [], documents: []
  };
}

function mapProvenance(p) {
  return p === "confirmed" ? "stated" : p === "suggested" ? "lean" : "open";
}

/* base44 gives "YYYY-MM-DD" or "YYYY-MM"; our month-type inputs want
   "YYYY-MM". Truncate rather than reformat — never invent a day. */
function toMonthInput(raw) {
  const m = /^(\d{4})-(\d{2})/.exec(raw || "");
  return m ? `${m[1]}-${m[2]}` : (raw || "");
}

const DEGREE_MAP = {
  bachelor: "BSc", master: "MSc", mba: "MBA", phd: "PhD",
  certificate: "Professional certificate", bootcamp: "Bootcamp certificate"
};
const SENIORITY_MAP = {
  intern: "Intern", entry: "Entry-level", associate: "Associate", mid: "Mid-level",
  senior: "Senior", lead: "Lead", manager: "Manager", director: "Director", executive: "Executive"
};
const EMPLOYMENT_MAP = {
  full_time: "Full-time", part_time: "Part-time", internship: "Internship",
  contract: "Contract", freelance: "Freelance", volunteer: "Volunteer"
};
const GPA_SCALE_MAP = { 4: "4.0", 5: "5.0", 10: "10.0", 20: "20.0", 100: "100" };

/* Spoken languages get their own top-level languages[] array in our
   schema (CEFR-scaled) instead of sharing a "language" skill category
   with programming languages, the way base44 does — base44's Python/R
   entries use the exact same category value as its Italian/English
   entries, which is the split this list exists to make. */
const SPOKEN_LANGUAGES = new Set(
  [...COMMON_LANGUAGES, "Hungarian", "Polish", "Turkish", "Swedish", "Norwegian", "Danish", "Greek", "Hebrew"].map(l => l.toLowerCase())
);
/* base44 proficiency words ("expert"/"advanced"/...) aren't CEFR bands —
   this is a labeled approximation, not a verified fact; flagged in the
   report so the user can correct any of the four by hand. */
const PROFICIENCY_TO_CEFR = { expert: "C2", advanced: "C1", intermediate: "B1", beginner: "A1" };

function convertEducationEntry(e) {
  return {
    id: nextId(),
    institution: e.organisation || "",
    institution_type: (e.institution_type || "").toLowerCase() === "university" ? "University"
      : INSTITUTION_TYPES.includes(e.institution_type) ? e.institution_type : "Other",
    degree_type: DEGREE_MAP[(e.degree_type || "").toLowerCase()] || "Other",
    field_of_study: e.field_of_study || "",
    gpa: e.gpa ? String(e.gpa) : "",
    gpa_scale: e.gpa ? (GPA_SCALE_MAP[e.gpa_scale] || "") : "",
    start: toMonthInput(e.start_date),
    end: toMonthInput(e.end_date)
  };
}

function convertExperienceEntry(e) {
  const industry = companyIndustryByName.get((e.organisation || "").toLowerCase()) || "";
  if (!industry && e.company_industry) {
    report(`  - "${e.organisation}" isn't in the verified company registry — industry left blank rather than trusting base44's own "${e.company_industry}" label (which isn't one of our standardized GICS values anyway).`);
  }
  return {
    id: nextId(),
    title: e.title || "",
    company: e.organisation || "",
    company_industry: industry,
    employment_type: EMPLOYMENT_MAP[(e.employment_type || "").toLowerCase()] || "",
    seniority: SENIORITY_MAP[(e.seniority || "").toLowerCase()] || "",
    location_city: e.location_city || "",
    location_country: e.location_country || "",
    start: toMonthInput(e.start_date),
    end: toMonthInput(e.end_date),
    is_current: !!e.is_current,
    // details is the clean bullet summary; source_note re-states
    // title/company/dates already captured in their own fields above —
    // carrying it over too would reproduce base44's "doubled" feel.
    description: e.details || ""
  };
}

function convertExtracurricular(e) {
  return {
    id: nextId(),
    name: e.organisation || "",
    role: e.title || "",
    description: e.details || ""
  };
}

function convertSkillsAndLanguages(rawSkills) {
  const skills = [], languages = [], certifications = [];
  const seenSkill = new Set(), seenLang = new Set(), seenCert = new Set();
  let duplicatesDropped = 0;

  rawSkills.forEach(s => {
    const name = (s.name || "").trim();
    if (!name) return;
    const category = (s.category || "").toLowerCase();
    const isSpokenLanguage = category === "language" && SPOKEN_LANGUAGES.has(name.toLowerCase());

    if (isSpokenLanguage) {
      const key = name.toLowerCase();
      if (seenLang.has(key)) { duplicatesDropped++; return; }
      seenLang.add(key);
      const cefr = PROFICIENCY_TO_CEFR[(s.proficiency || "").toLowerCase()] || "";
      languages.push({ id: nextId(), language: name, proficiency: cefr });
      return;
    }
    if (category === "certification") {
      const key = name.toLowerCase();
      if (seenCert.has(key)) { duplicatesDropped++; return; }
      seenCert.add(key);
      certifications.push({ id: nextId(), name, issuer: "", date: "", credential_id: "" });
      return;
    }
    const catMap = { tool: "Tool / software", technical: "Technical", domain: "Domain knowledge", soft: "Soft skill", language: "Technical" };
    const skillCategory = catMap[category] || (SKILL_CATEGORIES.includes(s.category) ? s.category : "");
    const key = name.toLowerCase() + "|" + skillCategory;
    if (seenSkill.has(key)) { duplicatesDropped++; return; }
    seenSkill.add(key);
    const proficiency = PROFICIENCY_LEVELS.find(p => p.toLowerCase() === (s.proficiency || "").toLowerCase()) || "";
    skills.push({ id: nextId(), name, category: skillCategory, proficiency, years_experience: s.years_experience || "" });
  });

  if (duplicatesDropped) report(`  - Dropped ${duplicatesDropped} duplicate skill/language/certification entries (base44's export listed several twice).`);
  return { skills, languages, certifications };
}

/* base44 stores each preferences[] key's value as the FULL superset
   including every "downstream" key's values (see profile_1.json:
   pay_floor's array contains roles+levels+locations+...+its own "€30k"
   appended last). The single new element added at each step, reading
   from the shortest array to the longest, is that key's real value. */
function decodePreferencesCascade(prefsArray) {
  const order = ["roles", "levels", "locations", "work_authorization", "availability", "industries", "companies", "pay_floor"];
  const byKey = {};
  prefsArray.forEach(p => { byKey[p.key] = p; });
  const present = order.filter(k => byKey[k]);
  present.sort((a, b) => (byKey[a].value || []).length - (byKey[b].value || []).length);
  const decoded = {};
  let prevLen = 0;
  present.forEach(k => {
    const arr = byKey[k].value || [];
    decoded[k] = arr.slice(prevLen);
    prevLen = arr.length;
  });
  return { decoded, provenanceByKey: Object.fromEntries(present.map(k => [k, byKey[k].provenance])) };
}

function convert(base44) {
  const p = emptyProfile();

  p.headline = { value: (base44.profile || {}).headline || "", source: mapProvenance((base44.profile || {}).headline_provenance), evidence: "" };
  p.story = { value: (base44.profile || {}).story || "", source: mapProvenance((base44.profile || {}).story_provenance), evidence: "" };

  const experiences = base44.experiences || [];
  experiences.filter(e => e.type === "education").forEach(e => p.education.push(convertEducationEntry(e)));
  experiences.filter(e => e.type === "work").forEach(e => p.experience.push(convertExperienceEntry(e)));
  experiences.filter(e => e.type === "achievement" || e.type === "project").forEach(e => p.background.extracurriculars.push(convertExtracurricular(e)));
  const unhandledTypes = experiences.filter(e => !["education", "work", "achievement", "project"].includes(e.type));
  if (unhandledTypes.length) report(`  - ${unhandledTypes.length} experience entries had an unrecognized "type" and were skipped: ${unhandledTypes.map(e => `"${e.title}" (${e.type})`).join(", ")}`);

  const { skills, languages, certifications } = convertSkillsAndLanguages(base44.skills || []);
  p.skills = skills; p.languages = languages; p.certifications = certifications;

  if (Array.isArray(base44.preferences) && base44.preferences.length) {
    const { decoded, provenanceByKey } = decodePreferencesCascade(base44.preferences);
    const src = key => mapProvenance(provenanceByKey[key] || "open");

    if (decoded.roles) p.preferences.roles = { value: decoded.roles, source: src("roles"), evidence: "" };
    if (decoded.levels) {
      const valid = decoded.levels.filter(v => LEVELS.includes(v));
      const dropped = decoded.levels.filter(v => !LEVELS.includes(v));
      p.preferences.levels = { value: valid, source: src("levels"), evidence: "" };
      if (dropped.length) report(`  - Level(s) not in our standard list, dropped: ${dropped.join(", ")}`);
    }
    if (decoded.locations) p.preferences.locations = { value: decoded.locations, source: src("locations"), evidence: "" };
    if (decoded.companies) p.preferences.companies = { value: decoded.companies, source: src("companies"), evidence: "" };

    if (decoded.industries) {
      const INDUSTRY_ALIASES = { technology: "Information Technology", finance: "Financials" };
      const mapped = [], unmapped = [];
      decoded.industries.forEach(v => {
        const alias = INDUSTRY_ALIASES[v.toLowerCase()];
        if (alias) mapped.push(alias);
        else if (INDUSTRY_LIST.includes(v)) mapped.push(v);
        else unmapped.push(v);
      });
      p.preferences.industries = { value: mapped.concat(unmapped), source: src("industries"), evidence: "" };
      if (unmapped.length) report(`  - Industry preference(s) with no clean match in our standardized GICS-based list, kept as free text rather than force-mapped: ${unmapped.join(", ")}`);
    }

    if (decoded.work_authorization && decoded.work_authorization[0]) {
      const raw = decoded.work_authorization[0];
      const map = { "work visa (sponsored)": "Would need sponsorship", "citizen": "Citizen / permanent resident", "authorized": "Currently authorized (visa or permit)" };
      const matched = WORK_AUTH_OPTIONS.find(o => o.toLowerCase() === raw.toLowerCase()) || map[raw.toLowerCase()];
      p.mobility.work_authorization = matched || "";
      if (!matched) report(`  - Work authorization preference "${raw}" didn't match our options — left blank, set it manually.`);
    }

    if (decoded.availability && decoded.availability[0]) {
      const raw = decoded.availability[0];
      report(`  - Availability preference "${raw}" doesn't map cleanly to our flexibility options (those describe notice/start timing, not a duration) — added as a context note instead of guessed.`);
      p.context_notes.push({ id: nextId(), label: "Availability (from base44 import)", text: raw });
    }

    if (decoded.pay_floor && decoded.pay_floor[0]) {
      const raw = decoded.pay_floor[0]; // e.g. "€30k"
      const num = parseInt(raw.replace(/[^\d]/g, ""), 10);
      const currency = raw.includes("€") ? "EUR" : raw.includes("£") ? "GBP" : raw.includes("$") ? "USD" : "USD";
      let bracket = "";
      if (num) {
        const k = num;
        if (k < 25) bracket = "Under 25k";
        else if (k < 40) bracket = "25k–40k";
        else if (k < 55) bracket = "40k–55k";
        else if (k < 70) bracket = "55k–70k";
        else if (k < 90) bracket = "70k–90k";
        else if (k < 120) bracket = "90k–120k";
        else bracket = "120k+";
      }
      p.preferences.pay_floor = { value: { bracket, currency, period: "year" }, source: src("pay_floor"), evidence: `Imported as "${raw}"` };
    }
  }

  if ((base44.profile || {}).name) {
    report(`  - base44's top-level profile.name ("${base44.profile.name}") has no equivalent field in our schema — added as a context note. Worth adding a real name field later if we keep needing it.`);
    p.context_notes.push({ id: nextId(), label: "Name (from base44 import)", text: base44.profile.name });
  }

  p.interests = Array.isArray(base44.interests) ? base44.interests : [];

  return p;
}

function main() {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath) {
    console.error("Usage: node scripts/convert-base44-profile.js <input.json> [output.json]");
    process.exitCode = 1;
    return;
  }
  const base44 = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const converted = convert(base44);
  const out = outputPath || inputPath.replace(/\.json$/, ".converted.json");
  fs.writeFileSync(out, JSON.stringify(converted, null, 2) + "\n");

  console.log(`Converted ${inputPath} -> ${out}`);
  console.log(`  education: ${converted.education.length}, experience: ${converted.experience.length}, extracurriculars: ${converted.background.extracurriculars.length}`);
  console.log(`  skills: ${converted.skills.length}, languages: ${converted.languages.length}, certifications: ${converted.certifications.length}`);
  if (notes.length) {
    console.log("\nThings worth checking by hand after you import this:");
    notes.forEach(n => console.log(n));
  }
  console.log("\nOpen index.html, click \"Import profile.json\", and pick the converted file.");
}

if (require.main === module) main();
module.exports = { convert };
