// ─────────────────────────────────────────────
//  Mobile nav toggle
// ─────────────────────────────────────────────
const navToggle = document.getElementById("navToggle");
const navLinks  = document.getElementById("navLinks");

navToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinks.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    navToggle.setAttribute("aria-expanded", "false");
  });
});

// Active nav link on scroll
const allSections = document.querySelectorAll("section[id]");
const linkMap = new Map(
  Array.from(navLinks.querySelectorAll("a")).map((a) => [
    a.getAttribute("href").slice(1),
    a,
  ])
);

const sectionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        linkMap.forEach((a) => a.classList.remove("active"));
        const active = linkMap.get(entry.target.id);
        if (active) active.classList.add("active");
      }
    });
  },
  { rootMargin: "-50% 0px -50% 0px" }
);

allSections.forEach((s) => sectionObserver.observe(s));

// ─────────────────────────────────────────────
//  Candidate Search
// ─────────────────────────────────────────────
const searchInput     = document.getElementById("candidateSearch");
const searchBtn       = document.getElementById("searchBtn");
const suggestionsList = document.getElementById("searchSuggestions");
const profilePanel    = document.getElementById("profilePanel");
const emptyState      = document.getElementById("emptyState");

let activeSuggestionIndex = -1;

function filterCandidates(query) {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return CANDIDATES.filter((c) => c.name.toLowerCase().includes(q));
}

function renderSuggestions(matches) {
  suggestionsList.innerHTML = "";
  activeSuggestionIndex = -1;

  if (!matches.length) {
    suggestionsList.hidden = true;
    return;
  }

  matches.forEach((c, i) => {
    const li = document.createElement("li");
    li.setAttribute("role", "option");
    li.id = `suggestion-${i}`;
    li.setAttribute("aria-selected", "false");
    li.dataset.candidateId = c.id;
    li.innerHTML = `<strong>${c.name}</strong><span>${c.role}</span>`;
    li.addEventListener("mousedown", (e) => {
      e.preventDefault();
      selectCandidate(c.id);
    });
    suggestionsList.appendChild(li);
  });

  suggestionsList.hidden = false;
}

searchInput.addEventListener("input", () => {
  renderSuggestions(filterCandidates(searchInput.value));
});

searchInput.addEventListener("keydown", (e) => {
  const items = suggestionsList.querySelectorAll("li");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeSuggestionIndex = Math.min(activeSuggestionIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeSuggestionIndex = Math.max(activeSuggestionIndex - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (activeSuggestionIndex >= 0) {
      selectCandidate(items[activeSuggestionIndex].dataset.candidateId);
    } else {
      const matches = filterCandidates(searchInput.value);
      if (matches.length) selectCandidate(matches[0].id);
    }
    return;
  } else if (e.key === "Escape") {
    closeSuggestions();
    return;
  }

  items.forEach((item, i) => {
    const active = i === activeSuggestionIndex;
    item.classList.toggle("suggestion-active", active);
    item.setAttribute("aria-selected", String(active));
  });
  searchInput.setAttribute(
    "aria-activedescendant",
    activeSuggestionIndex >= 0 ? `suggestion-${activeSuggestionIndex}` : ""
  );
});

searchBtn.addEventListener("click", () => {
  const matches = filterCandidates(searchInput.value);
  if (matches.length) selectCandidate(matches[0].id);
});

document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-wrapper")) closeSuggestions();
});

function closeSuggestions() {
  suggestionsList.hidden = true;
  activeSuggestionIndex = -1;
}

function selectCandidate(id) {
  const candidate = CANDIDATES.find((c) => c.id === id);
  if (!candidate) return;
  searchInput.value = candidate.name;
  closeSuggestions();
  renderProfile(candidate);
}

// ─────────────────────────────────────────────
//  Profile Rendering
// ─────────────────────────────────────────────
function renderProfile(c) {
  // Header
  document.getElementById("profileName").textContent  = c.name;
  document.getElementById("profileRole").textContent  = c.role;
  document.getElementById("profileParty").textContent = c.party;
  document.getElementById("profileOpenSecrets").href  = c.openSecretsUrl;

  const avatar = document.getElementById("profileAvatar");
  avatar.textContent    = c.name.split(" ").map((w) => w[0]).join("").slice(0, 2);
  avatar.dataset.party  = c.party.toLowerCase();

  // Render each tab
  renderFunding(c.funding);
  renderCareer(c.career);
  renderOpinions(c.opinions);
  renderSources(c.sources);
  renderMisconceptions(c.misconceptions);

  // Show panel on the Funding tab by default
  activateTab("funding");
  profilePanel.hidden = false;
  emptyState.hidden   = true;
  profilePanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ─────────────────────────────────────────────
//  TAB 1 — Funding
// ─────────────────────────────────────────────
function formatMoney(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function buildBars(containerId, sources) {
  const el = document.getElementById(containerId);
  el.innerHTML = "";
  const maxPct = Math.max(...sources.map((s) => s.pct));

  sources.forEach((s) => {
    const li = document.createElement("li");
    li.className = "funding-bar-item";
    li.innerHTML = `
      <div class="funding-bar-label">
        <span>${s.label}</span>
        <span class="funding-bar-amount">${formatMoney(s.amount)}</span>
      </div>
      <div class="funding-bar-track" role="img" aria-label="${s.pct}% of top contributions">
        <div class="funding-bar-fill" style="width:${(s.pct / maxPct) * 100}%" data-pct="${s.pct}%"></div>
      </div>`;
    el.appendChild(li);
  });
}

function renderFunding(funding) {
  document.getElementById("fundingTotal").textContent       = funding.total;
  document.getElementById("fundingTopIndustry").textContent = funding.topIndustry;
  document.getElementById("fundingSmallDonors").textContent = funding.smallDonorPct;

  // Plain-English summary
  const plainEl = document.getElementById("fundingPlainEnglish");
  if (funding.plainEnglish) {
    plainEl.querySelector(".plain-english-text").textContent = funding.plainEnglish;
    plainEl.hidden = false;
  } else {
    plainEl.hidden = true;
  }

  // Why it matters callout
  const whyEl = document.getElementById("fundingWhyItMatters");
  if (funding.whyItMatters) {
    whyEl.querySelector(".why-text").textContent = funding.whyItMatters;
    whyEl.hidden = false;
  } else {
    whyEl.hidden = true;
  }

  buildBars("fundingBars", funding.sources);
  buildBars("foreignFundingBars", funding.foreignSources);
}

// ─────────────────────────────────────────────
//  TAB 2 — Career History
// ─────────────────────────────────────────────
function renderCareer(career) {
  const timeline = document.getElementById("careerTimeline");
  timeline.innerHTML = "";

  career.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "career-entry";
    li.innerHTML = `
      <div class="career-years">${entry.years}</div>
      <div class="career-content">
        <strong>${entry.title}</strong>
        <em>${entry.org}</em>
        <p>${entry.description}</p>
      </div>`;
    timeline.appendChild(li);
  });
}

// ─────────────────────────────────────────────
//  TAB 3 — Opinions (topics → sub-issues)
// ─────────────────────────────────────────────
function alignmentLabel(score) {
  if (score >= 80) return { text: "Strongly supports",  cls: "align-strong-yes" };
  if (score >= 60) return { text: "Leans in favor",     cls: "align-yes"        };
  if (score >= 41) return { text: "Mixed position",     cls: "align-mixed"      };
  if (score >= 21) return { text: "Leans against",      cls: "align-no"         };
  return               { text: "Strongly opposed",  cls: "align-strong-no"  };
}

function renderOpinions(opinions) {
  const container = document.getElementById("opinionsList");
  container.innerHTML = "";

  opinions.forEach((topic) => {
    const group = document.createElement("div");
    group.className = "topic-group";
    group.id = `topic-${topic.id}`;

    // Topic header
    group.innerHTML = `
      <div class="topic-header">
        <span class="topic-icon" aria-hidden="true">${topic.icon}</span>
        <h4 class="topic-title">${topic.topic}</h4>
        <span class="topic-count">${topic.subIssues.length} issue${topic.subIssues.length > 1 ? "s" : ""}</span>
      </div>`;

    const subList = document.createElement("div");
    subList.className = "sub-issues";

    topic.subIssues.forEach((sub) => {
      const align = alignmentLabel(sub.alignment ?? 50);

      const subItem = document.createElement("div");
      subItem.className = "sub-issue-item";

      // Toggle button — shows label + alignment meter always
      const subToggle = document.createElement("button");
      subToggle.className = "sub-issue-toggle";
      subToggle.setAttribute("aria-expanded", "false");
      subToggle.setAttribute("aria-controls", `sub-${topic.id}-${sub.id}`);
      subToggle.innerHTML = `
        <div class="sub-issue-top-row">
          <span class="sub-issue-label">${sub.label}</span>
          <span class="sub-chevron" aria-hidden="true">▾</span>
        </div>
        <div class="alignment-row" aria-label="Support level: ${sub.alignment}%">
          <div class="alignment-track">
            <div class="alignment-fill ${align.cls}" style="width:${sub.alignment}%"></div>
          </div>
          <span class="alignment-label ${align.cls}">${align.text} · ${sub.alignment}%</span>
        </div>`;

      // Detail panel (hidden by default)
      const subDetail = document.createElement("div");
      subDetail.className = "sub-issue-detail";
      subDetail.id = `sub-${topic.id}-${sub.id}`;
      subDetail.hidden = true;

      let html = "";

      // Plain-English callout
      if (sub.plainEnglish) {
        html += `
          <div class="plain-english-box">
            <span class="box-label">In plain English</span>
            <p>${sub.plainEnglish}</p>
          </div>`;
      }

      // Why people are searching this
      if (sub.whyItMatters) {
        html += `
          <div class="why-matters-box">
            <span class="box-label">🔍 Why people are searching this</span>
            <p>${sub.whyItMatters}</p>
          </div>`;
      }

      // Full detail (for informed readers)
      html += `
        <details class="detail-deep">
          <summary>Dig deeper</summary>
          <p>${sub.detail}</p>
        </details>`;

      // Vote record
      if (sub.voteRecord && sub.voteRecord.length) {
        html += `<h5>Vote Record</h5><ul class="vote-record">`;
        sub.voteRecord.forEach((v) => {
          html += `
            <li>
              <span class="vote-year">${v.year}</span>
              <span class="vote-bill">${v.bill}</span>
              <span class="vote-badge ${voteClass(v.vote)}">${v.vote}</span>
            </li>`;
        });
        html += `</ul>`;
      }

      subDetail.innerHTML = html;

      subToggle.addEventListener("click", () => {
        const isOpen = subDetail.hidden;
        subDetail.hidden = !isOpen;
        subToggle.setAttribute("aria-expanded", String(isOpen));
        subToggle.querySelector(".sub-chevron").textContent = isOpen ? "▴" : "▾";
      });

      subItem.appendChild(subToggle);
      subItem.appendChild(subDetail);
      subList.appendChild(subItem);
    });

    group.appendChild(subList);
    container.appendChild(group);
  });
}

// Map vote text → CSS class
function voteClass(vote) {
  const v = vote.toLowerCase();
  if (v === "yes" || v === "co-sponsor" || v === "sponsored" || v === "supported" || v === "introduced") return "vote-yes";
  if (v.startsWith("no")) return "vote-no";
  return "vote-neutral";
}

// ─────────────────────────────────────────────
//  TAB 4 — Sources
// ─────────────────────────────────────────────
const BIAS_LABELS = {
  "nonpartisan":   { label: "Nonpartisan",   cls: "nonpartisan"   },
  "center":        { label: "Center",        cls: "center"        },
  "center-left":   { label: "Center-Left",   cls: "center-left"   },
  "center-right":  { label: "Center-Right",  cls: "center-right"  },
  "left":          { label: "Left",          cls: "left"          },
  "right":         { label: "Right",         cls: "right"         },
};

const TYPE_LABELS = {
  "government": "Gov't record",
  "nonprofit":  "Nonprofit",
  "factcheck":  "Fact-checker",
  "newspaper":  "Newspaper",
  "wire":       "Wire service",
  "academic":   "Academic",
};

function renderSources(sources) {
  const list = document.getElementById("sourcesList");
  list.innerHTML = "";
  if (!sources || !sources.length) return;

  sources.forEach((s) => {
    const bias = BIAS_LABELS[s.bias] || { label: s.bias, cls: "center" };
    const typeLabel = TYPE_LABELS[s.type] || s.type;

    const li = document.createElement("li");
    li.className = "source-item";
    li.innerHTML = `
      <div class="source-item-header">
        <a class="source-name" href="${s.url}" target="_blank" rel="noopener noreferrer">
          ${s.name} ↗
        </a>
        <div class="source-tags">
          <span class="bias-tag ${bias.cls}">${bias.label}</span>
          <span class="type-tag ${s.type}">${typeLabel}</span>
        </div>
      </div>
      <p class="source-description">${s.description}</p>`;
    list.appendChild(li);
  });
}

// ─────────────────────────────────────────────
//  TAB 5 — Misconceptions
// ─────────────────────────────────────────────
function renderMisconceptions(misconceptions) {
  const container = document.getElementById("misconceptionsList");
  container.innerHTML = "";
  if (!misconceptions || !misconceptions.length) return;

  misconceptions.forEach((m) => {
    const mythSourceHTML = m.mythSourceUrl
      ? `<a class="myth-source" href="${m.mythSourceUrl}" target="_blank" rel="noopener noreferrer">
           Where this claim comes from: ${m.mythSourceLabel} ↗
         </a>`
      : "";

    const card = document.createElement("div");
    card.className = "myth-card";
    card.innerHTML = `
      <div class="myth-category-tag">${m.category}</div>

      <div class="myth-block">
        <div class="myth-header">
          <span class="myth-icon" aria-hidden="true">✕</span>
          <span class="myth-heading">Common claim</span>
        </div>
        <p class="myth-text">"${m.myth}"</p>
        ${mythSourceHTML}
      </div>

      <div class="reality-block">
        <div class="reality-header">
          <span class="reality-icon" aria-hidden="true">✓</span>
          <span class="reality-heading">What the record shows</span>
        </div>
        <p class="reality-text">${m.reality}</p>
        <a class="reality-source" href="${m.sourceUrl}" target="_blank" rel="noopener noreferrer">
          Verify this: ${m.sourceLabel} ↗
        </a>
      </div>`;
    container.appendChild(card);
  });
}

// ─────────────────────────────────────────────
//  Tab switching
// ─────────────────────────────────────────────
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

function activateTab(tabId) {
  document.querySelectorAll(".tab").forEach((t) => {
    const on = t.dataset.tab === tabId;
    t.classList.toggle("active", on);
    t.setAttribute("aria-selected", String(on));
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.id !== `tab-${tabId}`);
  });
}
