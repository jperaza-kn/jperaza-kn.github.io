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

async function initPyodideAndModule() {
  py = await initPyodideBase({
    packages: ["numpy"],
    stderr: (s) => console.log("[pyodide]", s)
  });

  // Robust load: try local folder first, then shared assets folder
  try {
    await loadPythonFile(py, "./logistic_equation.py");
    console.log("[logistic] loaded ./logistic_equation.py");
  } catch (e1) {
    console.warn("[logistic] failed loading ./logistic_equation.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/logistic_equation.py");
    console.log("[logistic] loaded ../../../assets/mathlets/logistic_equation.py");
  }
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

async function computeData(params) {
  py.globals.set("K", params.K);
  py.globals.set("r", params.r);
  py.globals.set("x0", params.x0);
  py.globals.set("T", params.T);

  const out = py.runPython(`
compute_plot_data(K, r, x0, T=T, N=1200)
  `);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const K = Number(document.getElementById("K").value);
    const r = Number(document.getElementById("r").value);
    const x0 = Number(document.getElementById("x0").value);

    document.getElementById("KVal").textContent = fmt(K, 2);
    document.getElementById("rVal").textContent = fmt(r, 2);
    document.getElementById("x0Val").textContent = fmt(x0, 2);

    const T = 20.0;

    const [t, x, x_phase, dxdt_phase, eq, meta, yRange, pRange] = await computeData({ K, r, x0, T });

    // Time plot
    const tracesTime = [
      { type: "scatter", mode: "lines", x: t, y: x, line: { width: 2.6 }, name: "x(t)" },
      { type: "scatter", mode: "lines", x: [eq.t0, eq.tT], y: [0, 0], line: { width: 1.3, dash: "dash" }, name: "equilibrium x=0" },
      { type: "scatter", mode: "lines", x: [eq.t0, eq.tT], y: [K, K], line: { width: 1.3, dash: "dash" }, name: "equilibrium x=K" }
    ];

    const layoutTime = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "t", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "x(t)", range: yRange, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    // Phase plot
    const xmin = Math.min(...x_phase);
    const xmax = Math.max(...x_phase);
    const tracesPhase = [
      { type: "scatter", mode: "lines", x: x_phase, y: dxdt_phase, line: { width: 2.6 }, name: "trajectory" },
      { type: "scatter", mode: "lines", x: [0, 0], y: pRange, line: { width: 1.3, dash: "dash" }, name: "x=0" },
      { type: "scatter", mode: "lines", x: [K, K], y: pRange, line: { width: 1.3, dash: "dash" }, name: "x=K" },
      { type: "scatter", mode: "lines", x: [xmin, xmax], y: [0, 0], line: { width: 1.3, dash: "dot" }, name: "dx/dt=0" }
    ];

    const layoutPhase = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "x", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "dx/dt", range: pRange, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plot", tracesPhase, layoutPhase, { responsive: true });
    await Plotly.react("plot_time", tracesTime, layoutTime, { responsive: true });

    if (window.MathJax) MathJax.typesetPromise();

  } catch (e) {
    showErr(e);
    console.error(e);
  }
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

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  const sliderIds = ["K", "r", "x0"];
  sliderIds.forEach(id => updateDashSliderUI(document.getElementById(id)));

  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  await redraw();
}

main();
