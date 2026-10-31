#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * Regression test for the CV-paste/upload parser (app.js). This guards
 * a real bug found and fixed once already: once a block opened, every
 * following line — including the NEXT entry's own title/company/
 * location — was swallowed as that block's "details", because
 * pendingLines only ever filled before the very first date line in the
 * whole text. Institution/company/location never had a chance to be
 * split out correctly; that was the actual cause of "can't tell a city
 * from a school or a job", not the registry matching itself.
 *
 * Uses a small fixture registry, not the real 10k/3.6k lists — the
 * point here is the block-boundary and field-splitting logic, not
 * whether any particular company is in the real data.
 *
 * Run: node tests/cv-parsing.test.js
 * ------------------------------------------------------------------- */

const path = require("path");

global.UNIVERSITIES = [{ name: "Bocconi University", country: "Italy" }];
global.COMPANIES = [
  { name: "FTI Consulting", aliases: ["FTI Delta"], country: "United States", industry: "Consulting" },
  { name: "PwC", country: "United Kingdom", industry: "Consulting" }
];
global.LOCATIONS = [
  { city: "Milan", country: "Italy", display: "Milan, Italy" },
  { city: "Dubai", country: "United Arab Emirates", display: "Dubai, United Arab Emirates" }
];
global.universitiesIndex = null;
global.companiesIndex = null;

const { scanCvBlocks } = require(path.join("..", "app.js"));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) { failures++; console.error(`FAIL — ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`); }
  else console.log(`PASS — ${label}`);
}

// Shaped like real PDF-extracted text: no blank lines between entries,
// each field on its own line, a detail sentence between entries.
const cvText = [
  "Bachelor of Science in International Economics and Management",
  "Bocconi University",
  "Milan, Italy",
  "Sep 2022 - Jul 2025",
  "Business Analyst Intern",
  "FTI Delta",
  "Dubai, United Arab Emirates",
  "Jun 2026 - Aug 2026",
  "Advised on strategy for a gaming client and built a competitor analysis.",
  "Advisory Intern",
  "PwC",
  "Milan, Italy",
  "May 2025 - Oct 2025",
  "Analyzed procurement spend and modeled vendor forecasts."
].join("\n");

const blocks = scanCvBlocks(cvText);

check("exactly 3 entries detected, not merged or lost across the no-blank-line boundary", blocks.length, 3);

check("entry 1: education type with the degree as title, not the section heading or country", blocks[0] && blocks[0].type, "education");
check("entry 1: institution resolved via registry match", blocks[0] && blocks[0].institution, "Bocconi University");
check("entry 1: title holds only the degree, not the whole line-blob", blocks[0] && blocks[0].title, "Bachelor of Science in International Economics and Management");
check("entry 1: location split out correctly, not left jumbled into the title", blocks[0] && [blocks[0].location_city, blocks[0].location_country], ["Milan", "Italy"]);
check("entry 1: no bleed from entry 2's lines into details", blocks[0] && blocks[0].details, "");

check("entry 2: company resolved through a registry ALIAS (FTI Delta -> FTI Consulting), not left blank", blocks[1] && blocks[1].company, "FTI Consulting");
check("entry 2: title is just the job title, not the date range or a blob", blocks[1] && blocks[1].title, "Business Analyst Intern");
check("entry 2: location correctly split from company", blocks[1] && [blocks[1].location_city, blocks[1].location_country], ["Dubai", "United Arab Emirates"]);
check("entry 2: the detail sentence lands on entry 2, not swallowed into entry 1 or lost", blocks[1] && blocks[1].details, "Advised on strategy for a gaming client and built a competitor analysis.");

check("entry 3: company resolved (PwC), title is not the date string this bug used to produce", blocks[2] && [blocks[2].company, blocks[2].title], ["PwC", "Advisory Intern"]);
check("entry 3: location correctly split", blocks[2] && [blocks[2].location_city, blocks[2].location_country], ["Milan", "Italy"]);

// Regression test: "it considered my header as something while its just
// my name and linkedin and number" — a real bug report. A CV's top
// block (name, phone, email, LinkedIn URL) must never leak into the
// first real entry's title/company/location.
const cvWithHeader = [
  "Riccardo Cara",
  "linkedin.com/in/riccardocara",
  "+39 333 123 4567",
  "riccardo.cara@email.com",
  "Bachelor of Science in International Economics and Management",
  "Bocconi University",
  "Milan, Italy",
  "Sep 2022 - Jul 2025"
].join("\n");
const headerBlocks = scanCvBlocks(cvWithHeader);
check("header block is fully excluded: exactly 1 entry, not name/contact swallowed into it", headerBlocks.length, 1);
check("header block: title holds only the degree, no name/phone/email/URL contamination", headerBlocks[0] && headerBlocks[0].title, "Bachelor of Science in International Economics and Management");
check("header block: institution still resolves correctly despite the header lines ahead of it", headerBlocks[0] && headerBlocks[0].institution, "Bocconi University");

console.log(failures ? `\n${failures} check(s) failed.` : "\nAll checks passed.");
if (failures) process.exitCode = 1;
