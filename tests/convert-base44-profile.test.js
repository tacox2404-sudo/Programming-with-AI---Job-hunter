#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * Logic tests for scripts/convert-base44-profile.js, against a small
 * synthetic fixture shaped like a real base44 export — never the user's
 * own uploaded data, which stays out of the repo entirely (see the
 * script's own file header and PROTOCOL.md for why).
 *
 * Run: node tests/convert-base44-profile.test.js
 * ------------------------------------------------------------------- */

const path = require("path");
const { convert } = require(path.join("..", "scripts", "convert-base44-profile.js"));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`FAIL — ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  else console.log(`PASS — ${label}`);
}

const fixture = {
  profile: { name: "Test Candidate", headline: "H", story: "S", headline_provenance: "confirmed", story_provenance: "suggested" },
  experiences: [
    {
      type: "education", organisation: "Test University", institution_type: "university",
      degree_type: "bachelor", field_of_study: "Computer Science", gpa: 8, gpa_scale: 10,
      start_date: "2019-09-01", end_date: "2022-06-01", details: ""
    },
    {
      // 3M is a real S&P 500 entry in data/registry/companies.json (Industrials) —
      // exercises the registry lookup overriding base44's own loose "Manufacturing" label.
      type: "work", title: "Analyst", organisation: "3M", seniority: "intern",
      employment_type: "internship", company_industry: "Manufacturing",
      location_city: "Berlin", location_country: "Germany", is_current: false,
      start_date: "2022-06-01", end_date: "2022-08-31", details: "Did analyst things."
    },
    { type: "achievement", title: "Case Competition Winner", organisation: "Student Club", details: "Won a competition." }
  ],
  skills: [
    { name: "French", category: "language", proficiency: "advanced" },
    { name: "French", category: "language", proficiency: "advanced" }, // base44 duplicate, dropped on convert
    { name: "Python", category: "language", proficiency: "expert" },   // "language" category but not a spoken language
    { name: "AWS Certified", category: "certification", proficiency: "advanced" },
    { name: "Excel", category: "tool", proficiency: "expert" }
  ],
  preferences: [
    { key: "roles", value: ["Data analyst"], provenance: "confirmed" },
    { key: "levels", value: ["Data analyst", "Internship"], provenance: "confirmed" },
    { key: "locations", value: ["Data analyst", "Internship", "Berlin"], provenance: "confirmed" },
    { key: "work_authorization", value: ["Data analyst", "Internship", "Berlin", "Citizen"], provenance: "confirmed" },
    { key: "industries", value: ["Data analyst", "Internship", "Berlin", "Citizen", "Technology"], provenance: "confirmed" },
    { key: "pay_floor", value: ["Data analyst", "Internship", "Berlin", "Citizen", "Technology", "€25k"], provenance: "confirmed" }
  ],
  interests: []
};

const result = convert(fixture);

check("education type routes to education[] with degree mapped (bachelor -> BSc)", result.education[0].degree_type, "BSc");
check("gpa/gpa_scale carried over and mapped to our enum (10 -> \"10.0\")", [result.education[0].gpa, result.education[0].gpa_scale], ["8", "10.0"]);

check("work type routes to experience[] with seniority/employment_type mapped", [result.experience[0].seniority, result.experience[0].employment_type], ["Intern", "Internship"]);
check("company_industry comes from the verified registry (3M -> Industrials), not base44's own free-text label", result.experience[0].company_industry, "Industrials");
check("description uses the clean 'details' field, not a re-stated source_note", result.experience[0].description, "Did analyst things.");

check("achievement type routes to background.extracurriculars[]", [result.background.extracurriculars[0].name, result.background.extracurriculars[0].role], ["Student Club", "Case Competition Winner"]);

check("duplicate skill entries are deduped", result.languages.filter(l => l.language === "French").length, 1);
check("a spoken language (category 'language') routes to languages[], not skills[]", result.languages.some(l => l.language === "French"), true);
check("a programming language (also category 'language') stays in skills[], mapped to Technical", result.skills.some(s => s.name === "Python" && s.category === "Technical"), true);
check("category 'certification' routes to certifications[], not skills[]", result.certifications.some(c => c.name === "AWS Certified"), true);
check("certification does not also appear in skills[]", result.skills.some(s => s.name === "AWS Certified"), false);

check("preferences cascade decodes 'roles' as the shortest array", result.preferences.roles.value, ["Data analyst"]);
check("preferences cascade decodes 'levels' as the one new element vs. roles", result.preferences.levels.value, ["Internship"]);
check("preferences cascade decodes 'locations' as the one new element vs. levels", result.preferences.locations.value, ["Berlin"]);
check("work_authorization decodes and maps to our enum ('Citizen' -> 'Citizen / permanent resident')", result.mobility.work_authorization, "Citizen / permanent resident");
check("industries preference maps a clean alias ('Technology' -> 'Information Technology')", result.preferences.industries.value, ["Information Technology"]);
check("pay_floor decodes the currency symbol and buckets the number (€25k -> EUR, 25k–40k)", result.preferences.pay_floor.value, { bracket: "25k–40k", currency: "EUR", period: "year" });

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
if (failures) process.exitCode = 1;
