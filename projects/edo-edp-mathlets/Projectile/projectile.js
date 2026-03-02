let py = null;

function num(x) { return Number(x); }
function fmt(x, d = 2) { return Number(x).toFixed(d); }

function showErr(e) {
  const box = document.getElementById("errBox");
  if (!box) return;
  box.style.display = "block";

  // Pyodide errors usually have a useful .message (Python traceback)
  const msg = (e && e.message) ? e.message : String(e);
  box.textContent = msg;
}
function clearErr() {
  const box = document.getElementById("errBox");
  if (!box) return;
  box.style.display = "none";
  box.textContent = "";
}

async function initPyodideAndModule() {
  py = await initPyodideBase({
    packages: ["numpy"],
    stderr: (s) => console.log("[pyodide]", s)
  });

  // save python file at this path:
  await loadPythonFile(py, "../../../assets/mathlets/projectile.py");
}

function updateDashSliderUI(input) {
  const min = Number(input.min);
  const max = Number(input.max);
  const val = Number(input.value);
  const pct = ((val - min) / (max - min)) * 100;

  const wrap = input.closest(".slider-wrap");
  if (!wrap) return;

  wrap.style.setProperty("--fill", String(pct));

  const ticks = wrap.querySelectorAll(".dash-tick");
  ticks.forEach(t => {
    const pStr = t.style.getPropertyValue("--p").trim();
    const p = Number(pStr.replace("%", ""));
    t.classList.toggle("active", p <= pct + 1e-9);
  });
}

function setupLanguageToggle() {
  const langBtn = document.getElementById("langToggle");
  const textES = document.getElementById("text-es");
  const textEN = document.getElementById("text-en");
  if (!langBtn || !textES || !textEN) return;

  let currentLang = "es";
  langBtn.addEventListener("click", () => {
    if (currentLang === "es") {
      textES.style.display = "none";
      textEN.style.display = "block";
      langBtn.textContent = "Español";
      currentLang = "en";
    } else {
      textEN.style.display = "none";
      textES.style.display = "block";
      langBtn.textContent = "English";
      currentLang = "es";
    }
    if (window.MathJax) MathJax.typesetPromise();
  });
}

function readControls() {
  return {
    v0: num(document.getElementById("v0").value),
    theta: num(document.getElementById("theta").value),
    k: num(document.getElementById("kdrag").value),
    v0b: num(document.getElementById("v0b").value),
    thetab: num(document.getElementById("thetab").value),
    kb: num(document.getElementById("kdragb").value),
    use_newton: document.getElementById("useNewton").checked,
    g: num(document.getElementById("gval").value),
  };
}

function syncLabels(c) {
  document.getElementById("v0Val").textContent = fmt(c.v0, 0);
  document.getElementById("thetaVal").textContent = fmt(c.theta, 1);
  document.getElementById("kVal").textContent = fmt(c.k, 2);

  document.getElementById("v0bVal").textContent = fmt(c.v0b, 0);
  document.getElementById("thetabVal").textContent = fmt(c.thetab, 1);
  document.getElementById("kbVal").textContent = fmt(c.kb, 2);

  document.getElementById("gVal").textContent = fmt(c.g, 3);
}

function renderMetrics(payload) {
  const panel = document.getElementById("metrics_panel");
  if (!panel) return;

  const blocks = [];

  function block(title, color, m) {
    return `
      <div class="metric-block">
        <div class="metric-title" style="color:${color}">${title}</div>
        <div class="metric-line">Time of flight: ${fmt(m.tof, 3)} s</div>
        <div class="metric-line">Range: ${fmt(m.range, 3)} m</div>
        <div class="metric-line">Max height: ${fmt(m.h_max, 3)} m (x = ${fmt(m.x_hmax, 3)} m)</div>
        <div class="metric-line">Impact speed: ${fmt(m.final_speed, 3)} m/s</div>
      </div>
    `;
  }

  blocks.push(block("Reference A (k=0)", "green", payload.metrics.refA));
  blocks.push(block(`A — k=${fmt(payload.params.kA, 3)}`, "royalblue", payload.metrics.A));
  blocks.push(block(`B — k=${fmt(payload.params.kB, 3)}`, "crimson", payload.metrics.B));

  blocks.push(`<div class="metric-line" style="margin-top:6px; color: var(--muted);">
    Gravity model: ${payload.model}
  </div>`);

  panel.innerHTML = blocks.join("");
}

async function redraw() {
  try {
    clearErr();

    const c = readControls();
    syncLabels(c);

    // if Newton is on, g slider is “ignored” (still shown for continuity)
    // but we can optionally dim it (JS/CSS) — keep it simple here.

    py.globals.set("V0A", c.v0);
    py.globals.set("THA", c.theta);
    py.globals.set("KA", c.k);
    py.globals.set("V0B", c.v0b);
    py.globals.set("THB", c.thetab);
    py.globals.set("KB", c.kb);
    py.globals.set("USE_NEWTON", c.use_newton);
    py.globals.set("GVAL", c.g);

    const out = py.runPython(`
compute_all(float(V0A), float(THA), float(KA),
            float(V0B), float(THB), float(KB),
            bool(USE_NEWTON), float(GVAL))
    `);

    const payload = out.toJs();

    // --- Trajectory figure ---
    const tr = payload.traj;

    const trajTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: tr.refA.x, y: tr.refA.y,
        line: { width: 2.2, dash: "dash", color: "green" },
        name: "Reference A (k=0)"
      },
      {
        type: "scatter",
        mode: "lines",
        x: tr.A.x, y: tr.A.y,
        line: { width: 3.0, color: "royalblue" },
        name: `A: k=${fmt(payload.params.kA, 2)}`
      },
      {
        type: "scatter",
        mode: "lines",
        x: tr.B.x, y: tr.B.y,
        line: { width: 3.0, color: "crimson" },
        name: `B: k=${fmt(payload.params.kB, 2)}`
      }
    ];

    const trajLayout = {
      template: "plotly_dark",
      margin: { l: 45, r: 10, t: 10, b: 45 },
      xaxis: { title: "x (m)", range: payload.bounds.traj_x, showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "y (m)", range: payload.bounds.traj_y, showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0)" }
    };

    await Plotly.react("traj_plot", trajTraces, trajLayout, { responsive: true });

    // --- y(t) figure ---
    const yt = payload.yt;
    const ytTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: yt.A.t, y: yt.A.y,
        line: { width: 2.6, color: "royalblue" },
        name: "A: y(t)"
      },
      {
        type: "scatter",
        mode: "lines",
        x: yt.B.t, y: yt.B.y,
        line: { width: 2.6, color: "crimson" },
        name: "B: y(t)"
      }
    ];

    const ytLayout = {
      template: "plotly_dark",
      margin: { l: 45, r: 10, t: 10, b: 45 },
      xaxis: { title: "t (s)", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "y (m)", showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0)" }
    };

    await Plotly.react("yt_plot", ytTraces, ytLayout, { responsive: true });

    renderMetrics(payload);

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  const sliderIds = ["v0", "theta", "kdrag", "v0b", "thetab", "kdragb", "gval"];
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  document.getElementById("useNewton").addEventListener("change", () => redraw());

  // initial draw
  syncLabels(readControls());
  await redraw();
}

main();