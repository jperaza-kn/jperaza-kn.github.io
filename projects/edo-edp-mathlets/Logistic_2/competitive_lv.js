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

  try {
    await loadPythonFile(py, "./competitive_lv.py");
    console.log("[clv] loaded ./competitive_lv.py");
  } catch (e1) {
    console.warn("[clv] failed loading ./competitive_lv.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/competitive_lv.py");
    console.log("[clv] loaded ../../../assets/mathlets/competitive_lv.py");
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
  py.globals.set("r1", params.r1);
  py.globals.set("K1", params.K1);
  py.globals.set("a12", params.a12);
  py.globals.set("r2", params.r2);
  py.globals.set("K2", params.K2);
  py.globals.set("a21", params.a21);
  py.globals.set("x0", params.x0);
  py.globals.set("y0", params.y0);

  const out = py.runPython(`
compute_plot_data(r1, K1, a12, r2, K2, a21, x0, y0)
  `);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const r1 = Number(document.getElementById("r1").value);
    const K1 = Number(document.getElementById("K1").value);
    const a12 = Number(document.getElementById("a12").value);
    const r2 = Number(document.getElementById("r2").value);
    const K2 = Number(document.getElementById("K2").value);
    const a21 = Number(document.getElementById("a21").value);
    const x0 = Number(document.getElementById("x0").value);
    const y0 = Number(document.getElementById("y0").value);

    document.getElementById("r1Val").textContent = fmt(r1, 2);
    document.getElementById("K1Val").textContent = fmt(K1, 1);
    document.getElementById("a12Val").textContent = fmt(a12, 2);
    document.getElementById("r2Val").textContent = fmt(r2, 2);
    document.getElementById("K2Val").textContent = fmt(K2, 1);
    document.getElementById("a21Val").textContent = fmt(a21, 2);
    document.getElementById("x0Val").textContent = fmt(x0, 2);
    document.getElementById("y0Val").textContent = fmt(y0, 2);

    const [t, x, y, xlim, ylim] = await compute({ r1, K1, a12, r2, K2, a21, x0, y0 });

    const phaseTraces = [
      { type: "scatter", mode: "lines", x, y, line: { width: 2.6 }, name: "trajectory" },
      { type: "scatter", mode: "markers", x: [x[0]], y: [y[0]], marker: { size: 8 }, name: "initial" }
    ];

    const phaseLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "x (species 1)", range: xlim, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "y (species 2)", range: ylim, showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plot_phase", phaseTraces, phaseLayout, { responsive: true });

    const timeTraces = [
      { type: "scatter", mode: "lines", x: t, y: x, line: { width: 2.4 }, name: "x(t) species 1" },
      { type: "scatter", mode: "lines", x: t, y: y, line: { width: 2.4 }, name: "y(t) species 2" }
    ];

    const timeLayout = {
      template: "plotly_dark",
      margin: { l: 60, r: 10, t: 10, b: 55 },
      xaxis: { title: "t", range: [0, t[t.length - 1]], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "population", range: [0, Math.max(xlim[1], ylim[1])], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plot_time", timeTraces, timeLayout, { responsive: true });

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

  const sliderIds = ["r1","K1","a12","r2","K2","a21","x0","y0"];
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
