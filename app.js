"use strict";

/* ---------------------------------------------------------------------
 * Job Search Profile Builder
 * A static, no-backend intake wizard that produces a tagged preference
 * profile (stated / lean / open) and an editable review page.
 * ------------------------------------------------------------------- */

const STORAGE_KEY = "jobHunterProfile.v1";

function emptyProfile() {
  return {
    headline: { value: "", source: "open", evidence: "" },
    story: { value: "", source: "open", evidence: "" },
    interests: [],
    preferences: {
      roles: { value: [], source: "open", evidence: "" },
      levels: { value: [], source: "open", evidence: "" },
      locations: { value: [], source: "open", evidence: "" },
      availability: { value: "", source: "open", evidence: "" },
      industries: { value: [], source: "open", evidence: "" },
      companies: { value: [], source: "open", evidence: "" },
      pay_floor: { value: null, source: "open", evidence: "" },
      dealbreakers: { value: [], source: "open", evidence: "" }
    }
  };
}

/* ---------------------------------------------------------------------
 * Topic definitions — the whole intake script lives here. Each topic
 * knows how to render its own input, how to explore an unsure answer,
 * and how to read a value back out of the DOM.
 * ------------------------------------------------------------------- */

const TOPICS = [
  {
    key: "roles",
    scope: "preferences",
    question: "What kind of roles are you looking for?",
    hint: "Job titles or functions — e.g. \"software engineer\", \"data analyst\", \"marketing coordinator\".",
    type: "tags",
    explore: {
      intro: "That's normal this early on. A couple of angles that usually help:",
      points: [
        "Specialist track: pick one function and go deep from day one.",
        "Generalist / rotational track: try a few functions early, specialize later."
      ],
      questions: [
        "Think about the last project or task you actually enjoyed — what part of it excited you?",
        "Would you rather solve technical problems, work with people, or organize and coordinate things?"
      ]
    }
  },
  {
    key: "levels",
    scope: "preferences",
    question: "What level or type of position are you aiming for?",
    hint: "Internship, graduate scheme, entry-level analyst, junior role, etc.",
    type: "tags",
    explore: {
      intro: "Worth weighing before you decide:",
      points: [
        "Internship: lowest commitment, fastest way to learn, usually lower pay.",
        "Graduate scheme: structured, multi-rotation, competitive but strong long-term training.",
        "Direct entry-level role: immediate specialization and ownership, less hand-holding."
      ],
      questions: [
        "How soon do you want real, full-time responsibility?",
        "Do you value structured training over faster independence?"
      ]
    }
  },
  {
    key: "locations",
    scope: "preferences",
    question: "Where would you be willing to work?",
    hint: "Cities, countries, remote — whatever applies. You can add more than one.",
    type: "tags",
    followUp: {
      label: "Work authorization / visa situation (optional, but useful context)",
      placeholder: "e.g. EU citizen, needs sponsorship in the US, has a UK graduate visa..."
    },
    explore: {
      intro: "A few ways people usually frame this:",
      points: [
        "Stay local: keeps your support network and cost of living manageable.",
        "Relocate domestically: opens more roles, but logistics and cost matter.",
        "Relocate internationally: widest pool of options, but visa and authorization become real constraints."
      ],
      questions: [
        "Do you currently hold work authorization anywhere outside where you live now?",
        "Is staying near family, a partner, or a specific city a hard constraint for you?"
      ]
    }
  },
  {
    key: "availability",
    scope: "preferences",
    question: "When could you realistically start, and is there a hard deadline or window?",
    hint: "e.g. \"Immediately\", \"After graduation in June 2026\", \"Anytime in Q1\".",
    type: "text",
    explore: {
      intro: "Two things usually drive this:",
      points: [
        "A fixed event (graduation, visa expiry, current notice period) that sets your earliest date.",
        "No fixed event — availability is genuinely flexible."
      ],
      questions: [
        "Do you have a graduation date, or a current commitment that needs to end first?",
        "Is there a date before which you absolutely cannot start?"
      ]
    }
  },
  {
    key: "industries",
    scope: "preferences",
    question: "Which industries interest you?",
    hint: "Tech, finance, healthcare, education, non-profit — whatever fits.",
    type: "tags",
    explore: {
      intro: "Worth deciding which way you lean:",
      points: [
        "Pick 1–2 industries you already know something about and focus there.",
        "Stay open across many industries and let the role itself decide."
      ],
      questions: [
        "Which industries do you already follow news about, or feel curious about — even a little?",
        "Do you care more about the industry's mission, or about what the role actually involves day to day?"
      ]
    }
  },
  {
    key: "companies",
    scope: "preferences",
    question: "Any target companies in mind?",
    hint: "Specific employers you'd love to work for. Leave blank if none yet.",
    type: "tags",
    explore: {
      intro: "A quick way to think about it:",
      points: [
        "Target specific companies you already admire or know well.",
        "Stay open to any company that matches your role and industry criteria."
      ],
      questions: [
        "Are there companies you've already applied to, or would apply to without hesitation?",
        "Does company size matter to you — startup, scale-up, or large corporate?"
      ]
    }
  },
  {
    key: "pay_floor",
    scope: "preferences",
    question: "What's the lowest pay you'd realistically accept?",
    hint: "A number, and mention the currency and period (e.g. \"45000 USD/year\").",
    type: "text",
    explore: {
      intro: "Two ways people usually set this:",
      points: [
        "A hard number based on cost of living and financial needs.",
        "Staying flexible for the right opportunity, brand, or learning curve."
      ],
      questions: [
        "What's the minimum that covers your actual costs?",
        "Would you accept less for faster learning or a name-brand company?"
      ]
    }
  },
  {
    key: "dealbreakers",
    scope: "preferences",
    question: "Any dealbreakers — things that would make you say no immediately?",
    hint: "e.g. \"No remote option\", \"Unpaid\", \"Rotational shifts\".",
    type: "tags",
    explore: {
      intro: "Worth thinking through:",
      points: [
        "Past bad experiences (a brutal commute, no remote flexibility, a bad culture signal) often reveal real dealbreakers.",
        "It's equally fine to have none identified yet — that's a legitimate answer too."
      ],
      questions: [
        "Has anything made you dread or quit a past role, internship, or project?",
        "Is there a condition — location, hours, values — you already know you can't accept?"
      ]
    }
  },
  {
    key: "interests",
    scope: "top",
    question: "Last one — what are your personal interests?",
    hint: "For a fair, human picture of you. Hobbies, communities, anything you'd talk about for an hour.",
    type: "tags",
    explore: {
      intro: "No pressure on this one, but if it helps:",
      points: [],
      questions: [
        "What do you do in your free time that you'd happily talk about for an hour?",
        "Any hobbies, communities, or small interests you're quietly proud of?"
      ]
    }
  }
];

const LABELS = {
  roles: "Roles",
  levels: "Levels / position type",
  locations: "Locations",
  availability: "Availability",
  industries: "Industries",
  companies: "Target companies",
  pay_floor: "Pay floor",
  dealbreakers: "Dealbreakers"
};

/* Curated keyword lists used only to *suggest* — never to assert. */
const ROLE_KEYWORDS = [
  "software engineer", "data analyst", "data scientist", "product manager",
  "marketing", "sales", "business analyst", "financial analyst", "accountant",
  "designer", "ux designer", "consultant", "operations", "project manager",
  "customer success", "hr", "human resources", "recruiter", "researcher",
  "teacher", "nurse", "engineer", "developer", "analyst"
];
const INDUSTRY_KEYWORDS = [
  "fintech", "finance", "banking", "healthcare", "education", "e-commerce",
  "retail", "manufacturing", "consulting", "non-profit", "nonprofit",
  "government", "media", "gaming", "logistics", "energy", "insurance",
  "technology", "saas", "startup", "telecom", "pharma", "biotech"
];

/* ---------------------------------------------------------------------
 * State
 * ------------------------------------------------------------------- */

let profile = emptyProfile();
let cvSuggestions = { roles: [], industries: [] };
let topicIndex = 0;
let history = []; // chat log entries {who:'bot'|'user', text}

function saveProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, topicIndex, history }));
  } catch (e) {
    /* localStorage may be unavailable (e.g. private mode) — degrade silently */
  }
}

function loadSavedProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearSavedProfile() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
}

/* ---------------------------------------------------------------------
 * View switching
 * ------------------------------------------------------------------- */

function showView(name) {
  ["intro-view", "intake-view", "review-view"].forEach(id => {
    document.getElementById(id).classList.toggle("hidden", id !== name);
  });
}

function toast(msg) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 1800);
}

/* ---------------------------------------------------------------------
 * Intro view: optional CV/LinkedIn paste-to-prefill
 * ------------------------------------------------------------------- */

function scanCvText(text) {
  const lower = text.toLowerCase();
  const foundRoles = ROLE_KEYWORDS.filter(k => lower.includes(k));
  const foundIndustries = INDUSTRY_KEYWORDS.filter(k => lower.includes(k));
  return { roles: [...new Set(foundRoles)], industries: [...new Set(foundIndustries)] };
}

function renderCvSuggestions(found) {
  const box = document.getElementById("cv-suggestions");
  box.innerHTML = "";
  const groups = [
    { key: "roles", label: "Roles" },
    { key: "industries", label: "Industries" }
  ];
  let any = false;
  groups.forEach(g => {
    if (!found[g.key].length) return;
    any = true;
    const wrap = document.createElement("div");
    wrap.className = "suggestion-group";
    const h4 = document.createElement("h4");
    h4.textContent = `${g.label} we spotted — tick what applies`;
    wrap.appendChild(h4);
    found[g.key].forEach(word => {
      const label = document.createElement("label");
      label.className = "suggestion-chip";
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = word;
      cb.addEventListener("change", () => label.classList.toggle("checked", cb.checked));
      label.appendChild(cb);
      label.appendChild(document.createTextNode(word));
      wrap.appendChild(label);
    });
    box.appendChild(wrap);
  });
  if (!any) {
    box.innerHTML = "<p class=\"muted\">Nothing obvious matched — no problem, we'll just ask directly.</p>";
  } else {
    const btn = document.createElement("button");
    btn.className = "btn primary";
    btn.style.marginTop = "10px";
    btn.textContent = "Use checked suggestions & start";
    btn.addEventListener("click", () => {
      const checked = Array.from(box.querySelectorAll("input[type=checkbox]:checked"));
      checked.forEach(cb => {
        const group = cb.closest(".suggestion-group").querySelector("h4").textContent.includes("Roles")
          ? "roles" : "industries";
        if (!profile.preferences[group].value.includes(cb.value)) {
          profile.preferences[group].value.push(cb.value);
        }
        profile.preferences[group].source = "stated";
        profile.preferences[group].evidence = "Confirmed from a pasted CV / LinkedIn summary.";
      });
      startIntake();
    });
    box.appendChild(btn);
  }
  box.classList.remove("hidden");
}

function initIntroView() {
  document.getElementById("cv-scan-btn").addEventListener("click", () => {
    const text = document.getElementById("cv-paste").value.trim();
    if (!text) { toast("Paste something first, or just start without it."); return; }
    cvSuggestions = scanCvText(text);
    renderCvSuggestions(cvSuggestions);
  });
  document.getElementById("start-btn").addEventListener("click", startIntake);

  const saved = loadSavedProfile();
  if (saved && (saved.topicIndex > 0 || saved.topicIndex === undefined)) {
    const banner = document.getElementById("resume-banner");
    banner.classList.remove("hidden");
    document.getElementById("resume-btn").addEventListener("click", () => {
      profile = saved.profile;
      topicIndex = saved.topicIndex || 0;
      history = saved.history || [];
      if (topicIndex >= TOPICS.length) {
        renderReview();
        showView("review-view");
      } else {
        showView("intake-view");
        renderChatHistory();
        updateProgress();
        renderAnswerPanel(TOPICS[topicIndex]);
      }
    });
    document.getElementById("discard-btn").addEventListener("click", () => {
      clearSavedProfile();
      banner.classList.add("hidden");
      toast("Cleared. Starting fresh.");
    });
  }
}

/* ---------------------------------------------------------------------
 * Intake wizard
 * ------------------------------------------------------------------- */

function startIntake() {
  topicIndex = 0;
  history = [];
  showView("intake-view");
  renderChatHistory();
  renderTopic(0);
}

function addBotBubble(html) {
  history.push({ who: "bot", html });
  appendBubble("bot", html);
}
function addUserBubble(text) {
  history.push({ who: "user", html: escapeHtml(text) });
  appendBubble("user", escapeHtml(text));
}
function appendBubble(who, html) {
  const log = document.getElementById("chat-log");
  const div = document.createElement("div");
  div.className = `bubble ${who}`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}
function renderChatHistory() {
  const log = document.getElementById("chat-log");
  log.innerHTML = "";
  history.forEach(h => appendBubble(h.who, h.html));
}
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function updateProgress() {
  const pct = Math.round((topicIndex / TOPICS.length) * 100);
  document.getElementById("progress-bar").style.width = pct + "%";
}

function fieldFor(topic) {
  return topic.scope === "top" ? null : profile.preferences[topic.key];
}

function renderTopic(idx) {
  updateProgress();
  if (idx >= TOPICS.length) {
    finishIntake();
    return;
  }
  const topic = TOPICS[idx];

  let questionHtml = `<strong>${escapeHtml(topic.question)}</strong>`;
  if (topic.hint) questionHtml += `<div class="muted" style="margin-top:4px;font-size:0.85rem;">${escapeHtml(topic.hint)}</div>`;

  const preFilled = topic.key === "roles" ? profile.preferences.roles.value.slice()
    : topic.key === "industries" ? profile.preferences.industries.value.slice()
    : [];
  if (preFilled.length) {
    questionHtml += `<div class="muted" style="margin-top:6px;font-size:0.85rem;">Already noted from your CV: ${preFilled.map(escapeHtml).join(", ")}. Add more, or move on.</div>`;
  }

  addBotBubble(questionHtml);
  saveProfile();
  renderAnswerPanel(topic);
}

function renderAnswerPanel(topic) {
  const panel = document.getElementById("answer-panel");
  panel.innerHTML = "";

  const fieldRow = document.createElement("div");
  fieldRow.className = "field-row";
  const input = buildInput(topic, fieldRow);
  panel.appendChild(fieldRow);

  let followUpGetter = null;
  if (topic.followUp) {
    const fu = document.createElement("div");
    fu.className = "field-row";
    const label = document.createElement("label");
    label.textContent = topic.followUp.label;
    const ta = document.createElement("input");
    ta.type = "text";
    ta.placeholder = topic.followUp.placeholder;
    fu.appendChild(label);
    fu.appendChild(ta);
    panel.appendChild(fu);
    followUpGetter = () => ta.value.trim();
  }

  const actions = document.createElement("div");
  actions.className = "actions";

  const submitBtn = document.createElement("button");
  submitBtn.className = "btn primary";
  submitBtn.textContent = "Submit answer";
  submitBtn.addEventListener("click", () => {
    const value = input.getValue();
    const isEmpty = Array.isArray(value) ? value.length === 0 : !String(value || "").trim();
    if (isEmpty) { toast("Type something, or use one of the options below."); return; }
    const extra = followUpGetter ? followUpGetter() : "";
    commitAnswer(topic, value, "stated", extra);
  });

  const notSureBtn = document.createElement("button");
  notSureBtn.className = "btn secondary";
  notSureBtn.textContent = "Not sure — help me think";
  notSureBtn.addEventListener("click", () => showExplore(topic, followUpGetter));

  const skipBtn = document.createElement("button");
  skipBtn.className = "btn ghost";
  skipBtn.textContent = "Leave this open";
  skipBtn.addEventListener("click", () => commitAnswer(topic, defaultEmptyValue(topic), "open", ""));

  actions.appendChild(submitBtn);
  if (topic.explore) actions.appendChild(notSureBtn);
  actions.appendChild(skipBtn);
  panel.appendChild(actions);

  const backRow = document.createElement("div");
  backRow.style.marginTop = "10px";
  if (topicIndex > 0) {
    const backBtn = document.createElement("button");
    backBtn.className = "btn ghost";
    backBtn.textContent = "← back to previous question";
    backBtn.addEventListener("click", goBack);
    backRow.appendChild(backBtn);
    panel.appendChild(backRow);
  }
}

function defaultEmptyValue(topic) {
  return topic.type === "tags" ? [] : "";
}

function goBack() {
  topicIndex = Math.max(0, topicIndex - 1);
  // The bot question + user answer bubbles for the topic we're re-asking
  // are the last two entries in the log — drop them and re-render it.
  history = history.slice(0, Math.max(0, history.length - 2));
  const log = document.getElementById("chat-log");
  log.innerHTML = "";
  renderChatHistory();
  renderTopic(topicIndex);
}

function buildInput(topic, container) {
  const label = document.createElement("label");
  label.textContent = "Your answer";
  container.appendChild(label);

  if (topic.type === "tags") {
    const wrap = document.createElement("div");
    wrap.className = "chip-input";
    const chips = [];
    const existing = topic.scope === "top" ? profile.interests.map(i => i.value) : fieldFor(topic).value;
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.placeholder = "Type and press Enter";
    textInput.addEventListener("keydown", e => {
      if (e.key === "Enter" && textInput.value.trim()) {
        e.preventDefault();
        addChip(textInput.value.trim());
        textInput.value = "";
      }
    });
    function addChip(val) {
      if (chips.includes(val)) return;
      chips.push(val);
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = val;
      const rm = document.createElement("button");
      rm.textContent = "×";
      rm.type = "button";
      rm.addEventListener("click", () => {
        const i = chips.indexOf(val);
        if (i > -1) chips.splice(i, 1);
        chip.remove();
      });
      chip.appendChild(rm);
      wrap.insertBefore(chip, textInput);
    }
    wrap.appendChild(textInput);
    existing.forEach(v => addChip(v));
    container.appendChild(wrap);
    return { getValue: () => chips.slice() };
  }

  // plain text
  const inp = document.createElement("input");
  inp.type = "text";
  const existingVal = fieldFor(topic) ? fieldFor(topic).value : "";
  inp.value = existingVal || "";
  container.appendChild(inp);
  return { getValue: () => inp.value.trim() };
}

function showExplore(topic, followUpGetter) {
  let box = document.querySelector(".explore-box");
  if (box) box.remove();
  box = document.createElement("div");
  box.className = "explore-box";

  const h4 = document.createElement("h4");
  h4.textContent = topic.explore.intro;
  box.appendChild(h4);

  if (topic.explore.points.length) {
    const ul = document.createElement("ul");
    topic.explore.points.forEach(p => {
      const li = document.createElement("li");
      li.textContent = p;
      ul.appendChild(li);
    });
    box.appendChild(ul);
  }
  if (topic.explore.questions.length) {
    const ul2 = document.createElement("ul");
    topic.explore.questions.forEach(q => {
      const li = document.createElement("li");
      li.textContent = q;
      ul2.appendChild(li);
    });
    box.appendChild(ul2);
  }

  const leanRow = document.createElement("div");
  leanRow.className = "field-row";
  leanRow.style.marginTop = "12px";
  const leanLabel = document.createElement("label");
  leanLabel.textContent = "If you had to lean one way right now, what would it be?";
  const leanInput = document.createElement("input");
  leanInput.type = "text";
  leanInput.placeholder = "Optional — only if something's forming";
  leanRow.appendChild(leanLabel);
  leanRow.appendChild(leanInput);

  const reasonRow = document.createElement("div");
  reasonRow.className = "field-row";
  const reasonLabel = document.createElement("label");
  reasonLabel.textContent = "What's making you lean that way?";
  const reasonInput = document.createElement("textarea");
  reasonInput.rows = 2;
  reasonRow.appendChild(reasonLabel);
  reasonRow.appendChild(reasonInput);

  box.appendChild(leanRow);
  box.appendChild(reasonRow);

  const btnRow = document.createElement("div");
  btnRow.className = "actions";
  const saveLeanBtn = document.createElement("button");
  saveLeanBtn.className = "btn primary";
  saveLeanBtn.textContent = "Save as my lean";
  saveLeanBtn.addEventListener("click", () => {
    const val = topic.type === "tags"
      ? leanInput.value.split(",").map(s => s.trim()).filter(Boolean)
      : leanInput.value.trim();
    const isEmpty = Array.isArray(val) ? val.length === 0 : !val;
    if (isEmpty) { toast("Add a direction, or leave it fully open below."); return; }
    const extra = followUpGetter ? followUpGetter() : "";
    commitAnswer(topic, val, "lean", extra, reasonInput.value.trim());
  });
  const stillOpenBtn = document.createElement("button");
  stillOpenBtn.className = "btn ghost";
  stillOpenBtn.textContent = "Still not sure — leave it open";
  stillOpenBtn.addEventListener("click", () => commitAnswer(topic, defaultEmptyValue(topic), "open", ""));

  btnRow.appendChild(saveLeanBtn);
  btnRow.appendChild(stillOpenBtn);
  box.appendChild(btnRow);

  document.getElementById("answer-panel").appendChild(box);
  box.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function commitAnswer(topic, value, source, followUpText, evidence) {
  const userText = source === "open"
    ? "(left open)"
    : Array.isArray(value) ? value.join(", ") : String(value);
  addUserBubble(userText);

  if (topic.scope === "top") {
    // interests
    profile.interests = (Array.isArray(value) ? value : [value]).filter(Boolean).map(v => ({ value: v, source }));
  } else {
    const field = profile.preferences[topic.key];
    field.value = value;
    field.source = source;
    field.evidence = source === "lean" ? (evidence || "") : "";
    if (followUpText) {
      field.evidence = field.evidence ? `${field.evidence} Work authorization: ${followUpText}` : `Work authorization: ${followUpText}`;
    }
  }

  topicIndex += 1;
  saveProfile();
  renderTopic(topicIndex);
}

/* ---------------------------------------------------------------------
 * Finish intake → synthesize headline/story → review view
 * ------------------------------------------------------------------- */

function finishIntake() {
  synthesizeHeadlineAndStory();
  saveProfile();
  renderReview();
  showView("review-view");
}

function synthesizeHeadlineAndStory() {
  const p = profile.preferences;
  const filled = key => p[key].source !== "open" &&
    (Array.isArray(p[key].value) ? p[key].value.length > 0 : (p[key].value !== "" && p[key].value !== null));

  if (!filled("roles") && !filled("levels") && !filled("locations") && !filled("industries")) {
    profile.headline = { value: "A profile just getting started.", source: "lean", evidence: "Not enough was filled in yet to summarize further." };
    profile.story = { value: "Most fields are still open, and that's fine — come back and fill in what you learn about yourself over time.", source: "lean", evidence: "" };
    return;
  }

  const qualifier = key => (p[key].source === "lean" ? "possibly " : "");
  const asText = key => Array.isArray(p[key].value) ? p[key].value.join(" / ") : p[key].value;

  let headlineParts = [];
  if (filled("roles")) headlineParts.push(`${qualifier("roles")}${asText("roles")}`);
  if (filled("levels")) headlineParts.push(`(${asText("levels")})`);
  let headline = headlineParts.join(" ");
  if (filled("locations")) headline += ` — open to ${asText("locations")}`;
  headline = headline.trim() || "A profile taking shape.";
  headline = headline.charAt(0).toUpperCase() + headline.slice(1);

  const usedLean = ["roles", "levels", "locations", "industries", "availability"].some(k => p[k].source === "lean" && filled(k));

  let sentences = [];
  if (filled("roles")) sentences.push(`Looking for ${qualifier("roles")}${asText("roles")} roles${filled("levels") ? ` at the ${qualifier("levels")}${asText("levels")} level` : ""}.`);
  else if (filled("levels")) sentences.push(`Aiming for ${qualifier("levels")}${asText("levels")} positions.`);
  if (filled("industries")) sentences.push(`Interested in ${qualifier("industries")}${asText("industries")}.`);
  if (filled("locations")) sentences.push(`Open to ${qualifier("locations")}${asText("locations")}.`);
  if (filled("availability")) sentences.push(`Availability: ${p.availability.value}.`);
  if (filled("companies")) sentences.push(`Has an eye on ${asText("companies")}.`);
  if (filled("dealbreakers")) sentences.push(`Hard no on: ${asText("dealbreakers")}.`);
  if (profile.interests.length) sentences.push(`Outside of work: ${profile.interests.map(i => i.value).join(", ")}.`);

  profile.headline = {
    value: headline,
    source: "lean",
    evidence: "Composed from the fields you filled in during intake."
  };
  profile.story = {
    value: sentences.join(" "),
    source: usedLean ? "lean" : "stated",
    evidence: usedLean ? "Includes one or more fields you were still leaning on, not fully decided." : ""
  };
}

/* ---------------------------------------------------------------------
 * Review / edit page
 * ------------------------------------------------------------------- */

function badgeLabel(source) {
  return source === "stated" ? "Stated" : source === "lean" ? "Leaning" : "Open";
}

function renderReview() {
  const root = document.getElementById("review-content");
  root.innerHTML = "";

  // Headline / story block
  const hb = document.createElement("div");
  hb.className = "field-card headline-block";
  const hHead = document.createElement("div");
  hHead.className = "field-card-head";
  hHead.innerHTML = `<span class="label">Your profile</span>`;
  const hBadge = badgeEl(profile.headline.source);
  hHead.appendChild(hBadge);
  hb.appendChild(hHead);

  const headlineInput = document.createElement("input");
  headlineInput.className = "headline-text";
  headlineInput.value = profile.headline.value;
  headlineInput.addEventListener("blur", () => {
    profile.headline.value = headlineInput.value.trim();
    profile.headline.source = profile.headline.value ? "stated" : "open";
    hBadge.replaceWith(badgeEl(profile.headline.source));
    saveProfile();
  });
  hb.appendChild(headlineInput);

  const storyInput = document.createElement("textarea");
  storyInput.className = "story-text";
  storyInput.value = profile.story.value;
  storyInput.addEventListener("blur", () => {
    profile.story.value = storyInput.value.trim();
    profile.story.source = profile.story.value ? "stated" : "open";
    saveProfile();
  });
  hb.appendChild(storyInput);
  root.appendChild(hb);

  // Interests
  root.appendChild(buildInterestsCard());

  // Preferences
  TOPICS.filter(t => t.scope === "preferences").forEach(t => {
    root.appendChild(buildPreferenceCard(t));
  });

  // Footer actions
  const footer = document.createElement("div");
  footer.className = "review-footer";
  const exportBtn = document.createElement("button");
  exportBtn.className = "btn primary";
  exportBtn.textContent = "Download profile.json";
  exportBtn.addEventListener("click", exportProfile);
  const editBtn = document.createElement("button");
  editBtn.className = "btn secondary";
  editBtn.textContent = "Back to questions";
  editBtn.addEventListener("click", () => { showView("intake-view"); });
  const restartBtn = document.createElement("button");
  restartBtn.className = "btn danger";
  restartBtn.textContent = "Start over (new user)";
  restartBtn.addEventListener("click", () => {
    if (!confirm("This clears the current profile on this device. Continue?")) return;
    profile = emptyProfile();
    topicIndex = 0;
    history = [];
    clearSavedProfile();
    document.getElementById("cv-paste").value = "";
    document.getElementById("cv-suggestions").classList.add("hidden");
    document.getElementById("resume-banner").classList.add("hidden");
    showView("intro-view");
  });
  footer.appendChild(exportBtn);
  footer.appendChild(editBtn);
  footer.appendChild(restartBtn);
  root.appendChild(footer);
}

function badgeEl(source) {
  const span = document.createElement("span");
  span.className = `badge ${source}`;
  span.textContent = badgeLabel(source);
  return span;
}

function buildInterestsCard() {
  const card = document.createElement("div");
  card.className = "field-card";
  const head = document.createElement("div");
  head.className = "field-card-head";
  head.innerHTML = `<span class="label">Interests</span>`;
  let badge = badgeEl(profile.interests.length ? "stated" : "open");
  head.appendChild(badge);
  card.appendChild(head);

  function syncBadge() {
    const next = badgeEl(profile.interests.length ? "stated" : "open");
    head.replaceChild(next, badge);
    badge = next;
  }

  const wrap = document.createElement("div");
  wrap.className = "chip-input";
  function redraw() {
    wrap.querySelectorAll(".chip").forEach(c => c.remove());
    profile.interests.forEach((item, i) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = item.value;
      const rm = document.createElement("button");
      rm.textContent = "×";
      rm.type = "button";
      rm.addEventListener("click", () => {
        profile.interests.splice(i, 1);
        saveProfile();
        redraw();
        syncBadge();
      });
      chip.appendChild(rm);
      wrap.insertBefore(chip, wrap.lastChild);
    });
  }
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Add an interest and press Enter";
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && input.value.trim()) {
      e.preventDefault();
      profile.interests.push({ value: input.value.trim(), source: "stated" });
      input.value = "";
      saveProfile();
      redraw();
      syncBadge();
    }
  });
  wrap.appendChild(input);
  redraw();
  card.appendChild(wrap);
  if (!profile.interests.length) {
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = "Nothing added yet — that's fine.";
    card.appendChild(p);
  }
  return card;
}

function buildPreferenceCard(topic) {
  const field = profile.preferences[topic.key];
  const card = document.createElement("div");
  card.className = "field-card";

  const head = document.createElement("div");
  head.className = "field-card-head";
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = LABELS[topic.key];
  head.appendChild(label);

  const badge = badgeEl(field.source);
  head.appendChild(badge);

  const select = document.createElement("select");
  select.className = "source-select";
  ["stated", "lean", "open"].forEach(s => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = badgeLabel(s);
    if (s === field.source) opt.selected = true;
    select.appendChild(opt);
  });
  head.appendChild(select);
  card.appendChild(head);

  function syncBadge() {
    badge.className = `badge ${field.source}`;
    badge.textContent = badgeLabel(field.source);
  }

  // Value editor
  let valueEl;
  if (topic.type === "tags") {
    valueEl = document.createElement("div");
    valueEl.className = "chip-input";
    function redrawChips() {
      valueEl.querySelectorAll(".chip").forEach(c => c.remove());
      field.value.forEach((v, i) => {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = v;
        const rm = document.createElement("button");
        rm.textContent = "×";
        rm.type = "button";
        rm.addEventListener("click", () => {
          field.value.splice(i, 1);
          onFieldValueChanged();
          redrawChips();
        });
        chip.appendChild(rm);
        valueEl.insertBefore(chip, valueEl.lastChild);
      });
    }
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Add and press Enter";
    input.addEventListener("keydown", e => {
      if (e.key === "Enter" && input.value.trim()) {
        e.preventDefault();
        field.value.push(input.value.trim());
        input.value = "";
        onFieldValueChanged();
        redrawChips();
      }
    });
    valueEl.appendChild(input);
    redrawChips();
  } else if (topic.key === "pay_floor") {
    valueEl = document.createElement("input");
    valueEl.type = "text";
    valueEl.value = field.value === null || field.value === undefined ? "" : field.value;
    valueEl.placeholder = "e.g. 45000 USD/year";
    valueEl.addEventListener("blur", () => {
      field.value = valueEl.value.trim() || null;
      onFieldValueChanged();
    });
  } else {
    valueEl = document.createElement("input");
    valueEl.type = "text";
    valueEl.value = field.value || "";
    valueEl.addEventListener("blur", () => {
      field.value = valueEl.value.trim();
      onFieldValueChanged();
    });
  }
  card.appendChild(valueEl);

  // Evidence box (shown for lean)
  const evidenceBox = document.createElement("div");
  evidenceBox.className = "evidence-box";
  const evidenceArea = document.createElement("textarea");
  evidenceArea.rows = 2;
  evidenceArea.value = field.evidence || "";
  evidenceArea.placeholder = "Why you're leaning this way...";
  evidenceArea.addEventListener("blur", () => {
    field.evidence = evidenceArea.value.trim();
    saveProfile();
  });
  evidenceBox.appendChild(evidenceArea);
  evidenceBox.style.display = field.source === "lean" ? "block" : "none";
  card.appendChild(evidenceBox);

  function isEmpty() {
    return Array.isArray(field.value) ? field.value.length === 0 : !field.value;
  }

  function onFieldValueChanged() {
    if (select.value === field.source) {
      // auto-adjust only if the user hasn't manually pinned a source via the dropdown this round
      if (isEmpty()) {
        field.source = "open";
        field.evidence = "";
      } else if (field.source === "open") {
        field.source = "stated";
      }
    }
    select.value = field.source;
    syncBadge();
    evidenceBox.style.display = field.source === "lean" ? "block" : "none";
    saveProfile();
  }

  select.addEventListener("change", () => {
    field.source = select.value;
    if (field.source !== "lean") field.evidence = evidenceArea.value.trim() ? field.evidence : "";
    syncBadge();
    evidenceBox.style.display = field.source === "lean" ? "block" : "none";
    saveProfile();
  });

  return card;
}

function exportProfile() {
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "profile.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast("profile.json downloaded");
}

/* ---------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  initIntroView();
});
