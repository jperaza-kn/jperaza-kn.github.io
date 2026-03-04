
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

  // Robust load: local first, then shared assets
  try {
    await loadPythonFile(py, "./eikonal_snell.py");
    console.log("[eikonal] loaded ./eikonal_snell.py");
  } catch (e1) {
    console.warn("[eikonal] failed loading ./eikonal_snell.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/eikonal_snell.py");
    console.log("[eikonal] loaded ../../../assets/mathlets/eikonal_snell.py");
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

async function computeAll(n1, n2, t0) {
  py.globals.set("n1", n1);
  py.globals.set("n2", n2);
  py.globals.set("t0", t0);

  const out = py.runPython(`
compute_plot_data(n1, n2, t0)
  `);

  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const n1 = Number(document.getElementById("n1").value);
    const n2 = Number(document.getElementById("n2").value);
    const t0 = Number(document.getElementById("t0").value);

    document.getElementById("n1Val").textContent = fmt(n1, 2);
    document.getElementById("n2Val").textContent = fmt(n2, 2);
    document.getElementById("t0Val").textContent = fmt(t0, 2);

    const [
      Xray, Yray,
      Xtau, Ttau, xstar, taustar,
      t, xt, yt,
      meta,
      X_MIN, X_MAX, Y_MIN, Y_MAX
    ] = await computeAll(n1, n2, t0);

    // Meta readouts
    document.getElementById("xStar").textContent = fmt(xstar, 4);
    document.getElementById("tauStar").textContent = fmt(taustar, 4);
    document.getElementById("tInt").textContent = fmt(meta.t_interface, 4);
    document.getElementById("tArr").textContent = fmt(meta.t_arrive, 4);

    document.getElementById("snellLeft").textContent  = fmt(meta.n1 * meta.sin1, 5);
    document.getElementById("snellRight").textContent = fmt(meta.n2 * meta.sin2, 5);
    document.getElementById("snellRes").textContent   = fmt(meta.snell_residual, 5);

    // ---- Top plot: geometry (ray + interface)
    const interfaceX = [X_MIN, X_MAX];
    const interfaceY = [0, 0];

    const tracesTop = [
      {
        type: "scatter",
        mode: "lines",
        x: interfaceX,
        y: interfaceY,
        line: { width: 2, dash: "dot" },
        name: "interface y=0"
      },
      {
        type: "scatter",
        mode: "markers+text",
        x: [0, 2],
        y: [1, -1],
        text: ["source (0,1)", "target (2,-1)"],
        textposition: ["top right", "bottom right"],
        marker: { size: 9 },
        name: "endpoints"
      },
      {
        type: "scatter",
        mode: "lines+markers",
        x: Xray,
        y: Yray,
        line: { width: 3.2, color: "#1fc85b" },
        marker: { size: 7, color: "#1fc85b" },
        name: "refracted ray"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [xstar],
        y: [0],
        marker: { size: 9, color: "#74ff9e" },
        name: "interface point"
      }
    ];

    const layoutTop = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 50 },
      xaxis: { title: "x", range: [X_MIN, X_MAX], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "y", range: [Y_MIN, Y_MAX], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false, scaleanchor: "x", scaleratio: 1 },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plotTop", tracesTop, layoutTop, { responsive: true });

    // ---- Bottom plot: time series x(t), y(t) (plus tau(x) faint)
    const tracesBot = [
      {
        type: "scatter",
        mode: "lines",
        x: t, y: xt,
        line: { width: 2.6, color: "#1fc85b" },
        name: "x(t)"
      },
      {
        type: "scatter",
        mode: "lines",
        x: t, y: yt,
        line: { width: 2.2, color: "#74ff9e", dash: "dot" },
        name: "y(t)"
      }
    ];

    const layoutBot = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "time t", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "position components", showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plotBottom", tracesBot, layoutBot, { responsive: true });

    // typeset math if present
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

  const sliderIds = ["n1", "n2", "t0"];
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
