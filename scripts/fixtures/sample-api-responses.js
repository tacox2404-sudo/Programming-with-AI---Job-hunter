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
    },
    {
      // Exercises: (a) the non-professional title filter — should be
      // dropped entirely by normalize(), not just left unclassified.
      slug: "fixture-ausbildung-fachinformatiker", title: "Ausbildung zum Fachinformatiker (m/w/d)",
      company_name: "Fixture GmbH", remote: false, location: "München, Bayern, Deutschland",
      url: "https://example.com/arbeitnow/fixture-ausbildung", created_at: 1798761600,
      description: "Vocational apprenticeship.", tags: [], job_types: ["Full-time"]
    },
    {
      // Exercises: (b) company_industry lookup against a real S&P 500
      // name, and (c) German city -> canonical English translation.
      slug: "fixture-consultant-munich", title: "Consultant, Strategy",
      company_name: "3M", remote: false, location: "München, Bayern, Deutschland",
      url: "https://example.com/arbeitnow/fixture-consultant-munich", created_at: 1798761600,
      description: "Client-facing strategy work.", tags: [], job_types: ["Full-time"]
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
  ],
  "Greenhouse:Stripe": [
    {
      id: 900201, title: "Software Engineer, Payments",
      location: { name: "Remote - US" },
      updated_at: "2026-09-05T00:00:00Z",
      absolute_url: "https://example.com/greenhouse/stripe/900201",
      content: "<p>Build core payments infrastructure.</p>"
    }
  ],
  "Lever:Netflix": [
    {
      id: "900301", text: "Data Scientist, Recommendations",
      categories: { location: "Los Gatos, CA", commitment: "Full-time" },
      createdAt: 1798761600000,
      hostedUrl: "https://example.com/lever/netflix/900301",
      descriptionPlain: "Improve the recommendation ranking model."
    }
  ]
};
