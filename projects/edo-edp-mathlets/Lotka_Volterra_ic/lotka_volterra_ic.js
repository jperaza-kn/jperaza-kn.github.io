let py = null;

function fmt(x, d = 3) { return Number(x).toFixed(d); }

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

  // Robust load: local first, then shared assets
  try {
    await loadPythonFile(py, "./lotka_volterra_ic.py");
    console.log("[lv] loaded ./lotka_volterra_ic.py");
  } catch (e1) {
    console.warn("[lv] failed loading local py, trying assets...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/lotka_volterra_ic.py");
    console.log("[lv] loaded assets lotka_volterra_ic.py");
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

async function compute(alpha, beta, gamma, delta, x0, y0) {
  py.globals.set("alpha", alpha);
  py.globals.set("beta", beta);
  py.globals.set("gamma", gamma);
  py.globals.set("delta", delta);
  py.globals.set("x0", x0);
  py.globals.set("y0", y0);

  const out = py.runPython(`
compute_plot_data(alpha, beta, gamma, delta, x0, y0)
  `);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const alpha = Number(document.getElementById("alpha").value);
    const beta = Number(document.getElementById("beta").value);
    const gamma = Number(document.getElementById("gamma").value);
    const delta = Number(document.getElementById("delta").value);
    const x0 = Number(document.getElementById("x0").value);
    const y0 = Number(document.getElementById("y0").value);

    document.getElementById("alphaVal").textContent = fmt(alpha, 2);
    document.getElementById("betaVal").textContent = fmt(beta, 2);
    document.getElementById("gammaVal").textContent = fmt(gamma, 2);
    document.getElementById("deltaVal").textContent = fmt(delta, 2);
    document.getElementById("x0Val").textContent = fmt(x0, 2);
    document.getElementById("y0Val").textContent = fmt(y0, 2);

    const [t, x, y, px, pyPhase, C0, drift, xr0, xr1, yr0, yr1] =
      await compute(alpha, beta, gamma, delta, x0, y0);

    document.getElementById("chargeVal").textContent = fmt(C0, 6);
    document.getElementById("driftVal").textContent = `drift ≈ ${fmt(drift, 2)}e+0`;

    // Phase plot
    const phaseTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: px,
        y: pyPhase,
        line: { width: 2.4 },
        name: "orbit"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [x0],
        y: [y0],
        marker: { size: 7 },
        name: "(x₀,y₀)"
      }
    ];

    const phaseLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "prey  x", range: [xr0, xr1], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "predator  y", range: [yr0, yr1], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plotPhase", phaseTraces, phaseLayout, { responsive: true });

    // Time plot
    const timeTraces = [
      { type: "scatter", mode: "lines", x: t, y: x, line: { width: 2.2 }, name: "x(t) prey" },
      { type: "scatter", mode: "lines", x: t, y: y, line: { width: 2.2, dash: "dash" }, name: "y(t) predator" }
    ];

    const timeLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "t", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "population", showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plotTime", timeTraces, timeLayout, { responsive: true });

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  const sliderIds = ["alpha", "beta", "gamma", "delta", "x0", "y0"];
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
