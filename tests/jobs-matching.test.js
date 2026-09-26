#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * Logic tests for the job board's matching/filtering rules (jobs.js).
 * No browser, no DOM — jobs.js exports its pure scoring functions via a
 * CommonJS shim (guarded by `typeof module`) for exactly this purpose,
 * the same pattern taxonomies.js already uses.
 *
 * Run: node tests/jobs-matching.test.js
 * ------------------------------------------------------------------- */

const path = require("path");
const { scoreJob, dealbreakerViolations, payMeetsFloor } = require(path.join("..", "jobs.js"));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`FAIL — ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  else console.log(`PASS — ${label}`);
}

function makeProfile(overrides) {
  return Object.assign({
    preferences: {
      roles: { value: [] }, levels: { value: [] }, locations: { value: [] },
      industries: { value: [] }, pay_floor: { value: { bracket: "" } },
      dealbreakers: { value: [] }
    }
  }, overrides);
}

function makeJob(overrides) {
  return Object.assign({
    role_family: "", seniority: "", location_city: "", company_industry: "",
    pay_bracket: "", visa_sponsorship: null, work_mode: ""
  }, overrides);
}

/* --- scoreJob ---------------------------------------------------- */

check(
  "no profile at all -> null score",
  scoreJob(makeJob({}), null),
  null
);

check(
  "unstated preference axes don't count as applicable",
  scoreJob(makeJob({ role_family: "Sales" }), makeProfile({})).applicable,
  0
);

{
  const profile = makeProfile({ preferences: Object.assign(makeProfile({}).preferences, { roles: { value: ["Business Analyst"] } }) });
  const result = scoreJob(makeJob({ role_family: "Business analyst" }), profile);
  check("role preference matches case-insensitively", result.matched, ["role"]);
  check("role match scores 1/1", `${result.score}/${result.applicable}`, "1/1");
}

{
  const profile = makeProfile({ preferences: Object.assign(makeProfile({}).preferences, { locations: { value: ["London"] } }) });
  const result = scoreJob(makeJob({ location_city: "London, United Kingdom" }), profile);
  check("location preference matches by substring", result.matched, ["location"]);
}

{
  const profile = makeProfile({ preferences: Object.assign(makeProfile({}).preferences, { pay_floor: { value: { bracket: "25k–40k" } } }) });
  const meetsResult = scoreJob(makeJob({ pay_bracket: "40k–55k" }), profile);
  const missesResult = scoreJob(makeJob({ pay_bracket: "Under 25k" }), profile);
  check("pay above the floor bracket counts as a match", meetsResult.matched, ["pay"]);
  check("pay below the floor bracket is a miss, not a match", missesResult.missed, ["pay"]);
}

check("payMeetsFloor returns null (not false) when either bracket is unrecognized — unknown isn't 'below'", payMeetsFloor("", "25k–40k"), null);

/* --- dealbreakerViolations ----------------------------------------
   The tri-state visa_sponsorship check is the one real bug this
   project already found and fixed once (null being treated as false)
   — kept here as a permanent regression test. */

{
  const profile = makeProfile({ preferences: Object.assign(makeProfile({}).preferences, { dealbreakers: { value: ["No visa sponsorship"] } }) });
  check("visa_sponsorship: false triggers the dealbreaker", dealbreakerViolations(makeJob({ visa_sponsorship: false }), profile).length, 1);
  check("visa_sponsorship: null (unknown) must NOT trigger the dealbreaker", dealbreakerViolations(makeJob({ visa_sponsorship: null }), profile).length, 0);
  check("visa_sponsorship: true does not trigger the dealbreaker", dealbreakerViolations(makeJob({ visa_sponsorship: true }), profile).length, 0);
}

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
if (failures) process.exitCode = 1;
