"use strict";

/* ---------------------------------------------------------------------
 * Hand-written fixtures shaped like each source's real (documented) API
 * response, used ONLY by `node scripts/ingest-jobs.js --test` to check
 * the classify/dedupe/merge logic offline. Not real fetched postings —
 * never merged into data/jobs.json.
 * ------------------------------------------------------------------- */

module.exports = {
  Remotive: [
    {
      id: 900001, title: "Senior Software Engineer, Backend", company_name: "Fixture Corp",
      category: "Software Development", job_type: "full_time",
      candidate_required_location: "Worldwide",
      url: "https://example.com/remotive/900001",
      publication_date: "2026-09-01T00:00:00",
      description: "<p>Own our payments service backend.</p>",
      tags: ["Python", "Django", "Postgres"]
    },
    {
      id: 900002, title: "Marketing Intern", company_name: "Fixture Media",
      category: "Marketing", job_type: "internship",
      candidate_required_location: "Worldwide",
      url: "https://example.com/remotive/900002",
      publication_date: "2026-09-02T00:00:00",
      description: "<p>Support campaign planning.</p>",
      tags: ["Content", "Social"]
    }
  ],
  Arbeitnow: [
    {
      slug: "fixture-data-analyst-berlin", title: "Junior Data Analyst",
      company_name: "Fixture Analytics GmbH", remote: false, location: "Berlin, Germany",
      url: "https://example.com/arbeitnow/fixture-data-analyst-berlin",
      created_at: 1798761600,
      description: "Support reporting for the ops team.",
      tags: ["SQL", "Excel"], job_types: ["Full-time"]
    }
  ],
  TheMuse: [
    {
      id: 900101, name: "Consultant, Strategy", company: { name: "Fixture Consulting" },
      locations: [{ name: "London, UK" }], categories: [{ name: "Strategy" }],
      type: "Full Time", publication_date: "2026-09-03T00:00:00Z",
      contents: "<p>Lead client workstreams.</p>",
      refs: { landing_page: "https://example.com/themuse/900101" }
    }
  ]
};
