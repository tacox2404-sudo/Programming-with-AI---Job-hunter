#!/usr/bin/env node
"use strict";

/* ---------------------------------------------------------------------
 * Job ingestion pipeline — the "continuous update" half of the system
 * (the profile side's repeatable piece is the Import button in the
 * Profile Builder; see PROTOCOL.md for both).
 *
 * Pulls postings from a handful of free, keyless public job-board APIs,
 * classifies each into our controlled vocabularies (taxonomies.js),
 * dedupes against whatever's already in data/jobs.json by a stable id,
 * and merges the result back in — so running this repeatedly appends
 * and refreshes rather than replacing the dataset.
 *
 * IMPORTANT: this cannot run inside a network-restricted Claude Code
 * session — outbound access to these domains is blocked by org policy
 * there (confirmed: every one of these sources returned a proxy 403
 * when tested from that environment). It's meant to run in CI (see
 * .github/workflows/ingest-jobs.yml, scheduled) or on any machine with
 * normal internet access:
 *
 *   node scripts/ingest-jobs.js
 *
 * Run `node scripts/ingest-jobs.js --test` to exercise the classify /
 * dedupe / merge logic against local fixtures instead — zero network
 * calls, zero writes to the real data file. That's the "validate the
 * structure before depending on something live" step for this piece.
 * ------------------------------------------------------------------- */

const fs = require("fs");
const path = require("path");
const { classifyRoleFamily, classifySeniority } = require("../taxonomies.js");

const DATA_PATH = path.join(__dirname, "..", "data", "jobs.json");

function mapEmploymentType(raw) {
  const t = (raw || "").toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("part")) return "Part-time";
  if (t.includes("contract") || t.includes("freelance")) return "Contract";
  if (t.includes("full")) return "Full-time";
  return "";
}

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* Each source: fetch its own URL, pull the array of raw postings out of
   the response body, and map ONE raw posting to our intermediate shape.
   Fields a source doesn't actually provide are left "" / [] here —
   normalize() below turns that into the final record and never invents
   a value a source didn't give it. */
const SOURCES = [
  {
    name: "Remotive",
    url: "https://remotive.com/api/remote-jobs?limit=200",
    extract: body => JSON.parse(body).jobs || [],
    map: item => ({
      external_id: `remotive:${item.id}`,
      title: item.title || "",
      company: item.company_name || "",
      location_city: "Remote",
      work_mode: "Remote",
      employment_type: mapEmploymentType(item.job_type),
      required_skills: (item.tags || []).slice(0, 8),
      posted_date: (item.publication_date || "").slice(0, 10),
      source_url: item.url || "",
      description: stripHtml(item.description).slice(0, 400)
    })
  },
  {
    name: "Arbeitnow",
    url: "https://www.arbeitnow.com/api/job-board-api",
    extract: body => JSON.parse(body).data || [],
    map: item => ({
      external_id: `arbeitnow:${item.slug}`,
      title: item.title || "",
      company: item.company_name || "",
      location_city: item.remote ? "Remote" : (item.location || ""),
      work_mode: item.remote ? "Remote" : "",
      employment_type: mapEmploymentType((item.job_types || [])[0]),
      required_skills: (item.tags || []).slice(0, 8),
      posted_date: item.created_at ? new Date(item.created_at * 1000).toISOString().slice(0, 10) : "",
      source_url: item.url || "",
      description: stripHtml(item.description).slice(0, 400)
    })
  },
  {
    name: "TheMuse",
    url: "https://www.themuse.com/api/public/jobs?page=0",
    extract: body => JSON.parse(body).results || [],
    map: item => ({
      external_id: `themuse:${item.id}`,
      title: item.name || "",
      company: (item.company || {}).name || "",
      location_city: ((item.locations || [])[0] || {}).name || "",
      work_mode: "",
      employment_type: mapEmploymentType(item.type),
      required_skills: (item.categories || []).map(c => c.name).slice(0, 8),
      posted_date: (item.publication_date || "").slice(0, 10),
      source_url: (item.refs || {}).landing_page || "",
      description: stripHtml(item.contents).slice(0, 400)
    })
  }
];

/* No free source here reliably provides structured salary or a clean
   industry field — both are left unset rather than guessed. Guessing
   "industry" from a company name, in particular, is exactly the kind
   of fabrication this project has avoided everywhere else; a wrong
   guess is worse than an honest blank the UI can just not filter on. */
function normalize(source, raw) {
  const mapped = source.map(raw);
  if (!mapped.title || !mapped.company) return null;
  return {
    id: mapped.external_id,
    title: mapped.title,
    company: mapped.company,
    company_industry: "",
    role_family: classifyRoleFamily(mapped.title),
    seniority: classifySeniority(mapped.title),
    employment_type: mapped.employment_type || "",
    location_city: mapped.location_city || "",
    work_mode: mapped.work_mode || "",
    pay_bracket: "",
    currency: "",
    visa_sponsorship: null, // unknown — never conflated with "no" (see jobs.js dealbreaker check)
    required_skills: mapped.required_skills || [],
    posted_date: mapped.posted_date || "",
    description: mapped.description || "",
    source: source.name,
    source_url: mapped.source_url || "",
    ingested_at: new Date().toISOString()
  };
}

async function fetchSource(source) {
  const res = await fetch(source.url, { headers: { "User-Agent": "job-hunter-poc/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return source.extract(await res.text());
}

function loadExisting() {
  try { return JSON.parse(fs.readFileSync(DATA_PATH, "utf8")); }
  catch (e) { return []; }
}

/* Merging by stable id is what makes repeated runs additive instead of
   replacing the file: an already-known posting gets its fields
   refreshed but keeps its original ingested_at, a new one gets added,
   and nothing already in the file (e.g. from a source that failed this
   run) is ever dropped just because this run didn't see it again. */
function mergeJobs(existing, incoming) {
  const byId = new Map(existing.map(j => [j.id, j]));
  let added = 0, updated = 0;
  incoming.forEach(job => {
    if (!job) return;
    const prev = byId.get(job.id);
    if (!prev) { byId.set(job.id, job); added++; }
    else { byId.set(job.id, Object.assign({}, job, { ingested_at: prev.ingested_at, last_seen_at: new Date().toISOString() })); updated++; }
  });
  const merged = Array.from(byId.values()).sort((a, b) => (b.posted_date || "").localeCompare(a.posted_date || ""));
  return { merged, added, updated };
}

async function runLive() {
  const results = [];
  for (const source of SOURCES) {
    try {
      const raw = await fetchSource(source);
      raw.forEach(item => results.push(normalize(source, item)));
      console.log(`${source.name}: fetched ${raw.length} postings`);
    } catch (e) {
      console.error(`${source.name}: FAILED (${e.message}) — skipping this source, continuing with the rest.`);
    }
  }
  const { merged, added, updated } = mergeJobs(loadExisting(), results);
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(merged, null, 2) + "\n");
  console.log(`data/jobs.json: ${added} new, ${updated} refreshed, ${merged.length} total.`);
}

function runTest() {
  const fixtures = require("./fixtures/sample-api-responses.js");
  const results = [];
  SOURCES.forEach(source => {
    (fixtures[source.name] || []).forEach(item => {
      const n = normalize(source, item);
      if (n) results.push(n);
    });
  });
  console.log(`[test] normalized ${results.length} fixture postings from ${SOURCES.length} sources (no network, no disk writes):`);
  results.forEach(r => console.log(`  - "${r.title}" @ ${r.company} -> role_family="${r.role_family || "(unclassified)"}" seniority="${r.seniority || "(unclassified)"}"`));

  if (!results.length) { console.error("[test] FAIL — no fixtures normalized"); process.exitCode = 1; return; }

  const existingFixture = [Object.assign({}, results[0], { ingested_at: "2020-01-01T00:00:00.000Z" })];
  const { merged, added, updated } = mergeJobs(existingFixture, results);
  console.log(`[test] merge check: existing=${existingFixture.length}, incoming=${results.length} -> added=${added}, updated=${updated}, total=${merged.length}`);

  const checks = [
    [merged.length === results.length, "merge total should equal distinct incoming postings"],
    [updated === 1 && added === results.length - 1, "exactly the pre-existing posting should be 'updated', the rest 'added'"],
    [(merged.find(j => j.id === existingFixture[0].id) || {}).ingested_at === "2020-01-01T00:00:00.000Z", "re-ingesting an existing posting must preserve its original ingested_at"]
  ];
  const failed = checks.filter(([ok]) => !ok);
  failed.forEach(([, msg]) => console.error("[test] FAIL — " + msg));
  console.log(failed.length ? `[test] ${failed.length} check(s) failed.` : "[test] PASS — all checks passed.");
  if (failed.length) process.exitCode = 1;
}

const args = process.argv.slice(2);
if (args.includes("--test")) runTest();
else runLive().catch(err => { console.error("Ingestion failed:", err); process.exitCode = 1; });
