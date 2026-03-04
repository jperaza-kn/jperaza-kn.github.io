let py = null;

function fmt(x, d = 2) { return Number(x).toFixed(d); }

function showErr(e) {
  const box = document.getElementById("errBox");
  if (!box) return;
  box.style.display = "block";
  box.textContent = (e && e.stack) ? e.stack : String(e);
}
function clearErr() {
  const box = document.getElementById("errBox");
  if (!box) return;
  box.style.display = "none";
  box.textContent = "";
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

async function initPyodideAndModule() {
  py = await initPyodideBase({
    packages: ["numpy", "sympy"],
    stderr: (s) => console.log("[pyodide]", s),
  });

  try {
    await loadPythonFile(py, "./lyapunov.py");
    console.log("[lyap] loaded ./lyapunov.py");
  } catch (e1) {
    console.warn("[lyap] failed ./lyapunov.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/lyapunov.py");
    console.log("[lyap] loaded ../../../assets/mathlets/lyapunov.py");
  }
}

function readUI() {
  return {
    fx: document.getElementById("fx").value,
    gy: document.getElementById("gy").value,
    T: Number(document.getElementById("T").value),
    x0: Number(document.getElementById("x0").value),
    y0: Number(document.getElementById("y0").value),
  };
}

let userSolutions = [];

function clearSolutions() { userSolutions = []; }

async function computeAll(want_solution) {
  const ui = readUI();
  const gridN = 10;
  const dt = 0.02;

  py.globals.set("f_str", ui.fx);
  py.globals.set("g_str", ui.gy);
  py.globals.set("T", ui.T);
  py.globals.set("dt", dt);
  py.globals.set("grid_n", gridN);
  py.globals.set("xlim", [-2.5, 2.5]);
  py.globals.set("ylim", [-2.5, 2.5]);
  py.globals.set("x0", ui.x0);
  py.globals.set("y0", ui.y0);
  py.globals.set("want_solution", want_solution ? 1 : 0);

  const out = py.runPython(`
compute_all(f_str, g_str, T, dt, grid_n, xlim, ylim, x0, y0, bool(want_solution))
  `);
  return out.toJs();
}

function makePhaseLayout() {
  return {
    template: "plotly_dark",
    margin: { l: 55, r: 10, t: 10, b: 55 },
    xaxis: { title: "x", range: [-2.5, 2.5], showgrid: true, gridcolor: "#444", zeroline: false },
    yaxis: { title: "y", range: [-2.5, 2.5], showgrid: true, gridcolor: "#444", zeroline: false },
    paper_bgcolor: "#1e1e1e",
    plot_bgcolor: "#1e1e1e",
    font: { color: "#f0f0f0" },
    showlegend: false,
  };
}

function makeVLayout() {
  return {
    template: "plotly_dark",
    margin: { l: 55, r: 10, t: 10, b: 55 },
    xaxis: { title: "x", range: [-2.5, 2.5], showgrid: true, gridcolor: "#444", zeroline: false },
    yaxis: { title: "y", range: [-2.5, 2.5], showgrid: true, gridcolor: "#444", zeroline: false },
    paper_bgcolor: "#1e1e1e",
    plot_bgcolor: "#1e1e1e",
    font: { color: "#f0f0f0" },
    showlegend: false,
  };
}

function latexBlock(f_latex, g_latex) {
  return `
<div class="mj">
  \\[
    \\dot x = ${f_latex},\\qquad \\dot y = ${g_latex}.
  \\]
</div>`;
}

function lyapunovBlock(ly) {
  if (!ly || !ly.found) return `<div><strong>Lyapunov:</strong> not detected by heuristics.</div>`;
  return `
<div class="mj">
  <div><strong>Candidate Lyapunov:</strong> (${ly.type})</div>
  <div style="margin-top:6px;">\\[ V(x,y) = ${ly.V_latex}. \\]</div>
  <div style="margin-top:6px; color: var(--muted); font-size: 13px;">${ly.notes || ""}</div>
</div>`;
}

async function redrawPhase(data) {
  const traces = [];
  for (const tr of data.trajs) {
    traces.push({
      type: "scatter",
      mode: "lines",
      x: tr.x, y: tr.y,
      line: { width: 1.1, color: "rgba(102, 232, 140, 0.25)" },
      hoverinfo: "skip",
    });
  }
  for (const sol of userSolutions) {
    traces.push({
      type: "scatter",
      mode: "lines",
      x: sol.x, y: sol.y,
      line: { width: 2.6, color: "rgba(50, 210, 90, 0.95)" },
      hoverinfo: "skip",
    });
  }
  await Plotly.react("plotPhase", traces, makePhaseLayout(), { responsive: true });
}

async function redrawV(data) {
  const wrap = document.getElementById("plotVwrap");
  if (!data.Vgrid || !data.lyapunov || !data.lyapunov.found) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "block";
  const V = data.Vgrid;
  const trace = {
    type: "contour",
    x: V.x,
    y: V.y,
    z: V.z,
    contours: { coloring: "heatmap" },
    opacity: 0.95,
    hoverinfo: "skip",
  };
  await Plotly.react("plotV", [trace], makeVLayout(), { responsive: true });
}

async function fullRedraw() {
  try {
    clearErr();
    const ui = readUI();
    document.getElementById("TVal").textContent = fmt(ui.T, 1);
    updateDashSliderUI(document.getElementById("T"));

    const data = await computeAll(false);

    document.getElementById("eqLatex").innerHTML = latexBlock(data.f_latex, data.g_latex);
    document.getElementById("lyBox").innerHTML = lyapunovBlock(data.lyapunov);

    if (window.MathJax) await MathJax.typesetPromise();

    await redrawPhase(data);
    await redrawV(data);

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

async function addSolution() {
  try {
    clearErr();
    const data = await computeAll(true);
    if (!data.solution) return;
    userSolutions.push({ x: data.solution.x, y: data.solution.y });
    await fullRedraw();
  } catch (e) { showErr(e); }
}

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  updateDashSliderUI(document.getElementById("T"));

  document.getElementById("T").addEventListener("input", async (ev) => {
    updateDashSliderUI(ev.target);
    await fullRedraw();
  });

  document.getElementById("applyBtn").addEventListener("click", async () => {
    clearSolutions();
    await fullRedraw();
  });

  document.getElementById("addSolBtn").addEventListener("click", async () => {
    await addSolution();
  });

  document.getElementById("clearBtn").addEventListener("click", async () => {
    clearSolutions();
    await fullRedraw();
  });

  await fullRedraw();
}

main();
