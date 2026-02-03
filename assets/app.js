const $ = (sel) => document.querySelector(sel);

function setNavOpen(open) {
    document.body.dataset.navOpen = String(open);
    const btn = $("#menuBtn");
    btn?.setAttribute("aria-expanded", String(open));
    const overlay = $("#overlay");
    if (overlay) overlay.hidden = !open;
}

function setupMenu() {
    const btn = $("#menuBtn");
    const overlay = $("#overlay");

    btn?.addEventListener("click", () => {
        const isOpen = document.body.dataset.navOpen === "true";
        setNavOpen(!isOpen);
    });

    overlay?.addEventListener("click", () => setNavOpen(false));

    document.querySelectorAll(".nav a").forEach(a => {
        a.addEventListener("click", () => setNavOpen(false));
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "Escape") setNavOpen(false);
    });

    setNavOpen(false);
}

function markActiveNav() {
    const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();
    document.querySelectorAll(".nav a").forEach(a => {
        const href = (a.getAttribute("href") || "").toLowerCase();
        if (href === path) a.classList.add("active");
    });
}

async function loadJSON(path) {
    const r = await fetch(path, { cache: "no-store" });
    if (!r.ok) throw new Error(`Failed ${path}: ${r.status}`);
    return r.json();
}

/* --------- Simple bar chart (canvas) --------- */
function drawBars(canvas, values, labels = []) {
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(240, Math.floor(rect.width || canvas.parentElement?.clientWidth || 260));
    const cssH = Math.round((cssW / 260) * 140);

    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const text = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#e8eef7";
    const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#1f2a3a";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#74b3ff";

    const W = cssW, H = cssH;
    ctx.clearRect(0, 0, W, H);

    const padL = 10, padR = 10, padT = 10, padB = labels.length ? 22 : 12;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + innerH);
    ctx.lineTo(padL + innerW, padT + innerH);
    ctx.stroke();

    const max = Math.max(1, ...values);
    const n = values.length || 1;
    const gap = Math.max(6, innerW * 0.04);
    const barW = (innerW - gap * (n - 1)) / n;

    for (let i = 0; i < n; i++) {
        const v = values[i] ?? 0;
        const h = (v / max) * innerH;
        const x = padL + i * (barW + gap);
        const y = padT + (innerH - h);

        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, y, barW, h);
    }
    ctx.globalAlpha = 1;

    if (labels.length) {
        ctx.fillStyle = text;
        ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
        ctx.textAlign = "center";
        for (let i = 0; i < n; i++) {
            const x = padL + i * (barW + gap) + barW / 2;
            ctx.fillText(String(labels[i] ?? ""), x, H - 6);
        }
    }
}

/* --------- Data helpers --------- */
function computePapersPerYear(items, maxYears = 6) {
    const counts = new Map();
    for (const p of items) {
        const y = p.year;
        if (!y) continue;
        counts.set(y, (counts.get(y) || 0) + 1);
    }
    const years = [...counts.keys()].sort((a, b) => b - a).slice(0, maxYears).sort((a, b) => a - b);
    return { labels: years.map(String), values: years.map(y => counts.get(y) || 0) };
}

function computeCitationsPerPaper(items, topN = 6) {
    const arr = items
        .map(p => ({ c: Number(p.cited_by_count || 0) }))
        .sort((a, b) => b.c - a.c)
        .slice(0, topN)
        .reverse();
    return { labels: arr.map((_, i) => String(i + 1)), values: arr.map(x => x.c) };
}

/* --------- Scholar-like renderer (used on HOME for latest N) --------- */
function renderScholarList(listEl, items, n) {
    if (!listEl) return;

    const sorted = [...items].sort((a, b) => {
        const da = a.publication_date ? Date.parse(a.publication_date) : NaN;
        const db = b.publication_date ? Date.parse(b.publication_date) : NaN;
        if (!Number.isNaN(da) && !Number.isNaN(db)) return db - da;
        return (b.year || 0) - (a.year || 0);
    });

    const subset = (typeof n === "number") ? sorted.slice(0, n) : sorted;

    listEl.innerHTML = "";
    for (const p of subset) {
        const li = document.createElement("li");
        li.className = "scholar-item";

        const title = p.title || "Untitled";
        const url = p.url || "";
        const authors = p.authors || "";
        const venue = p.venue || "";
        const year = p.year ? String(p.year) : "";
        const cited = Number(p.cited_by_count || 0);

        li.innerHTML = `
      <div class="sch-title">
        ${url ? `<a href="${url}" target="_blank" rel="noopener">${title}</a>` : title}
      </div>
      <div class="sch-authors">${authors}</div>
      <div class="sch-meta">
        ${venue}${venue && year ? " · " : ""}${year}
        <span class="sch-cited">· Cited by ${cited.toLocaleString()}</span>
      </div>
    `;
        listEl.appendChild(li);
    }
}

/* --------- Tree toggles (+ / −) --------- */
function setupTreeToggles() {
    document.addEventListener("click", (e) => {
        const btn = e.target.closest(".tree-toggle");
        if (!btn) return;

        const group = btn.closest(".tree-group");
        if (!group) return;

        const isOpen = group.classList.toggle("open");
        btn.setAttribute("aria-expanded", String(isOpen));
        const icon = btn.querySelector(".tree-icon");
        if (icon) icon.textContent = isOpen ? "−" : "+";
    });
}

function computeCitationsHistogram(items) {
    // INSPIRE-like bins:
    const bins = [
        { label: "0", min: 0, max: 0 },
        { label: "1-9", min: 1, max: 9 },
        { label: "10-49", min: 10, max: 49 },
        { label: "50-99", min: 50, max: 99 },
        { label: "100-249", min: 100, max: 249 },
        { label: "250-499", min: 250, max: 499 },
        { label: "500+", min: 500, max: Infinity }
    ];

    const citable = Array(bins.length).fill(0);
    const published = Array(bins.length).fill(0);

    function binIndex(c) {
        for (let i = 0; i < bins.length; i++) {
            if (c >= bins[i].min && c <= bins[i].max) return i;
        }
        return bins.length - 1;
    }

    for (const p of items) {
        const c = Number(p.cited_by_count || 0);
        const i = binIndex(c);

        // Defaults if booleans are missing:
        const isCitable = p.is_citable !== false;          // treat most as citable
        const isPublished = p.is_published === true;       // only true when known published

        if (isCitable) citable[i] += 1;
        if (isPublished) published[i] += 1;
    }

    return {
        labels: bins.map(b => b.label),
        seriesA: citable,      // Citable
        seriesB: published     // Published
    };
}

function drawGroupedBars(canvas, valuesA, valuesB, labels = [], legendA = "Citable", legendB = "Published") {
    if (!canvas) return;

    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const cssW = Math.max(240, Math.floor(rect.width || canvas.parentElement?.clientWidth || 260));
    const rotate = cssW < 420;
    // base height + extra space if rotated labels
    const baseH = Math.round((cssW / 260) * 150);
    const cssH = Math.max(170, baseH + (rotate ? 55 : 0));
    //const cssH = Math.round((cssW / 260) * 150);
    canvas.style.height = cssH + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const text = getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#e8eef7";
    const border = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#1f2a3a";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#74b3ff";

    const W = cssW, H = cssH;
    ctx.clearRect(0, 0, W, H);

    const padL = 12, padR = 12, padT = 10;
    const padB = rotate ? 60 : 30;
    const innerW = W - padL - padR;
    const innerH = H - padT - padB;

    // baseline
    ctx.strokeStyle = border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, padT + innerH);
    ctx.lineTo(padL + innerW, padT + innerH);
    ctx.stroke();

    const n = labels.length || Math.max(valuesA.length, valuesB.length, 1);
    const max = Math.max(1, ...valuesA, ...valuesB);

    const groupGap = Math.max(10, innerW * 0.03);
    const groupW = (innerW - groupGap * (n - 1)) / n;
    const barGap = Math.max(4, groupW * 0.10);
    const barW = (groupW - barGap) / 2;

    // Bars
    for (let i = 0; i < n; i++) {
        const a = valuesA[i] ?? 0;
        const b = valuesB[i] ?? 0;

        const ha = (a / max) * innerH;
        const hb = (b / max) * innerH;

        const x0 = padL + i * (groupW + groupGap);
        const yBase = padT + innerH;

        // A (Citable): accent
        ctx.fillStyle = accent;
        ctx.globalAlpha = 0.90;
        ctx.fillRect(x0, yBase - ha, barW, ha);

        // B (Published): same accent, lower alpha
        ctx.globalAlpha = 0.45;
        ctx.fillRect(x0 + barW + barGap, yBase - hb, barW, hb);
    }
    ctx.globalAlpha = 1;

    // X labels
    ctx.fillStyle = text;
    ctx.font = "12px system-ui, -apple-system, Segoe UI, Roboto, Arial";
    ctx.textAlign = "center";
    const approxSlot = innerW / n;
    const step = rotate && approxSlot < 34 ? 2 : 1;

    const labelY = padT + innerH + 10;

    for (let i = 0; i < n; i += step) {
        const x0 = padL + i * (groupW + groupGap);
        const cx = x0 + groupW / 2;

        ctx.save();
        ctx.translate(cx, labelY);

        if (rotate) {
            ctx.rotate(-Math.PI / 4);
            ctx.textAlign = "right";
            ctx.textBaseline = "top";
            ctx.fillText(String(labels[i] ?? ""), 0, 0);
        } else {
            ctx.textAlign = "center";
            ctx.textBaseline = "alphabetic";
            ctx.fillText(String(labels[i] ?? ""), 0, 12);
        }

        ctx.restore();
    }
}
async function initHomeIfPresent() {
    const latestList = $("#latestList");
    const collabVal = $("#collabVal");
    const hindexVal = $("#hindexVal");
    const canvas1 = $("#papersPerYear");
    const canvas2 = $("#citesHistogram");

    const isHome = !!(latestList || collabVal || hindexVal || canvas1 || canvas2);
    if (!isHome) return;

    let pubs = [];

    try {
        const stats = await loadJSON("data/stats.json");
        if (collabVal) collabVal.textContent = (stats.collaborators ?? "—").toLocaleString?.() ?? stats.collaborators ?? "—";
        if (hindexVal) hindexVal.textContent = (stats.h_index ?? "—").toLocaleString?.() ?? stats.h_index ?? "—";
    } catch { }

    try {
        const pubData = await loadJSON("data/publications.json");
        pubs = pubData.items || [];
    } catch { }

    // HOME: show only the latest N publications
    if (latestList) renderScholarList(latestList, pubs, 5);

    const redraw = () => {
        if (canvas1) {
            const ppy = computePapersPerYear(pubs, 6);
            drawBars(canvas1, ppy.values, ppy.labels);
        }
        if (canvas2) {
            const hist = computeCitationsHistogram(pubs);
            drawGroupedBars(canvas2, hist.seriesA, hist.seriesB, hist.labels);
        }
    };

    redraw();

    let t = null;
    window.addEventListener("resize", () => {
        clearTimeout(t);
        t = setTimeout(redraw, 120);
    });
}

async function initMathletsIfPresent() {
  const grid = document.querySelector("#mathletsGrid");
  if (!grid) return;

  const search = document.querySelector("#mathletsSearch");
  const tagsEl = document.querySelector("#mathletsTags");

  let data = { items: [] };
  try {
    data = await loadJSON("data/mathlets.json");
  } catch {}

  const items = (data.items || []).map(x => ({
    title: x.title || "Untitled",
    description: x.description || "",
    tags: Array.isArray(x.tags) ? x.tags : [],
    url: x.url || x.href || "",     // supports either url or href
    year: x.year || null
  }));

  const allTags = [...new Set(items.flatMap(i => i.tags))]
    .sort((a, b) => a.localeCompare(b));

  let activeTag = "";

  function renderTags() {
    tagsEl.innerHTML = "";
    const makeBtn = (t, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tag" + (activeTag === t ? " active" : "");
      b.textContent = label;
      b.addEventListener("click", () => {
        activeTag = (activeTag === t ? "" : t);
        renderTags();
        renderGrid();
      });
      return b;
    };

    tagsEl.appendChild(makeBtn("", "All"));
    allTags.forEach(t => tagsEl.appendChild(makeBtn(t, t)));
  }

  function renderGrid() {
    const q = (search?.value || "").trim().toLowerCase();
    grid.innerHTML = "";

    const filtered = items.filter(it => {
      const hitTag = !activeTag || it.tags.includes(activeTag);
      const hitQ =
        !q ||
        it.title.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q) ||
        it.tags.join(" ").toLowerCase().includes(q);
      return hitTag && hitQ;
    });

    for (const it of filtered) {
      const card = document.createElement("div");
      card.className = "mathlet-card";

      card.innerHTML = `
        <div class="mathlet-title">${it.title}</div>
        <div class="mathlet-desc">${it.description}</div>
        <div class="mathlet-tags">
          ${(it.tags || []).map(t => `<span class="pill">${t}</span>`).join("")}
        </div>
        <div class="mathlet-actions">
          ${it.url ? `<a class="btnlink" href="${it.url}" target="_blank" rel="noopener">Open</a>` : ""}
        </div>
      `;

      grid.appendChild(card);
    }
  }

  search?.addEventListener("input", renderGrid);

  renderTags();
  renderGrid();
}

(function main() {
    setupMenu();
    markActiveNav();
    setupTreeToggles();
    initHomeIfPresent();
    initMathletsIfPresent();
})();