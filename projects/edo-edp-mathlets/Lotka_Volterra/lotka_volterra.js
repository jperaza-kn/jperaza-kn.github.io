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

  // Robust: try local folder first, then shared assets folder.
  try {
    await loadPythonFile(py, "./lotka_volterra.py");
    console.log("[lv] loaded ./lotka_volterra.py");
  } catch (e1) {
    console.warn("[lv] failed loading ./lotka_volterra.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/lotka_volterra.py");
    console.log("[lv] loaded ../../../assets/mathlets/lotka_volterra.py");
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

async function compute(params) {
  py.globals.set("alpha", params.alpha);
  py.globals.set("beta", params.beta);
  py.globals.set("gamma", params.gamma);
  py.globals.set("delta", params.delta);

  const out = py.runPython(`
compute_plot_data(alpha, beta, gamma, delta)
  `);

  return out.toJs();
  // [t, x, y, phase_x, phase_y, x_range, y_range, t_max, x0, y0]
}

async function redraw() {
  try {
    clearErr();

    const alpha = Number(document.getElementById("alpha").value);
    const beta = Number(document.getElementById("beta").value);
    const gamma = Number(document.getElementById("gamma").value);
    const delta = Number(document.getElementById("delta").value);

    document.getElementById("alphaVal").textContent = fmt(alpha, 2);
    document.getElementById("betaVal").textContent = fmt(beta, 2);
    document.getElementById("gammaVal").textContent = fmt(gamma, 2);
    document.getElementById("deltaVal").textContent = fmt(delta, 2);

    const [t, x, y, px, pyTraj, xRange, yRange, tMax, x0, y0] = await compute({ alpha, beta, gamma, delta });

    // Phase plot: (x(t), y(t))
    const phaseTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: px, y: pyTraj,
        line: { width: 2.6 },
        name: "trajectory"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [px[0]], y: [pyTraj[0]],
        marker: { size: 8 },
        name: `start (x₀=${fmt(x0, 1)}, y₀=${fmt(y0, 1)})`
      }
    ];

    const phaseLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "prey  x", range: xRange, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "predator  y", range: yRange, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("phasePlot", phaseTraces, phaseLayout, { responsive: true });

    // Time plot: x(t), y(t)
    const timeTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: t, y: x,
        line: { width: 2.2 },
        name: "prey  x(t)"
      },
      {
        type: "scatter",
        mode: "lines",
        x: t, y: y,
        line: { width: 2.2, dash: "dot" },
        name: "predator  y(t)"
      }
    ];

    const yMax = Math.max(...x, ...y);
    const yRangeT = [0, yMax * 1.08 + 1e-9];

    const timeLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "time  t", range: [0, tMax], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "population", range: yRangeT, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("timePlot", timeTraces, timeLayout, { responsive: true });

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

  const sliderIds = ["alpha", "beta", "gamma", "delta"];
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
