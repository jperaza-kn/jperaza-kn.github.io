let py = null;

const sliderIds = ["x0", "p0", "alpha", "t"];

function fmt2(x) { return Number(x).toFixed(2); }

// error helper
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

  await loadPythonFile(py, "../../../assets/mathlets/harmonic_oscillator.py");
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

function syncValueLabels() {
  document.getElementById("x0Val").textContent = fmt2(document.getElementById("x0").value);
  document.getElementById("p0Val").textContent = fmt2(document.getElementById("p0").value);
  document.getElementById("alphaVal").textContent = fmt2(document.getElementById("alpha").value);
  document.getElementById("tVal").textContent = fmt2(document.getElementById("t").value);
}

async function computeData(x0, p0, alpha, t) {
  py.globals.set("x0", Number(x0));
  py.globals.set("p0", Number(p0));
  py.globals.set("alpha", Number(alpha));
  py.globals.set("tcur", Number(t));

  const out = py.runPython(`compute_fig_data(x0, p0, alpha, tcur)`);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const x0 = Number(document.getElementById("x0").value);
    const p0 = Number(document.getElementById("p0").value);
    const alpha = Number(document.getElementById("alpha").value);
    const t = Number(document.getElementById("t").value);

    syncValueLabels();

    const d = await computeData(x0, p0, alpha, t);

    // --- Phase plot
    const phaseTraces = [
      {
        type: "contour",
        x: d.x_grid,
        y: d.p_grid,
        z: d.H,
        ncontours: 20,
        showscale: false,
        contours: { coloring: "none", showlines: true },
        line: { color: "#888", width: 1 },
        name: "Energy levels"
      },
      {
        type: "scatter",
        mode: "lines",
        x: d.xs,
        y: d.ps,
        line: { color: "rgb(16,150,72)", width: 3.5 },
        name: "Trajectory"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [d.x0],
        y: [d.p0],
        marker: { size: 10, color: "#ffcc00", line: { color: "#222", width: 1.5 } },
        name: "IC"
      }
    ];

    const phaseLayout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: {
        title: "x",
        range: [-5, 5],
        showgrid: true,
        gridcolor: "#444",
        zeroline: false,
        scaleanchor: "y",
        scaleratio: 1.0
      },
      yaxis: {
        title: "p",
        range: [-5, 5],
        showgrid: true,
        gridcolor: "#444",
        zeroline: false
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.4)" },
      annotations: []
    };

    if (d.arrow) {
      phaseLayout.annotations.push({
        x: d.arrow.x, y: d.arrow.y,
        ax: d.arrow.ax, ay: d.arrow.ay,
        xref: "x", yref: "y", axref: "x", ayref: "y",
        showarrow: true,
        arrowhead: 2,
        arrowsize: 1,
        arrowwidth: 2.5,
        arrowcolor: "rgb(16,150,72)"
      });
    }

    await Plotly.react("phasePlot", phaseTraces, phaseLayout, { responsive: true });

    // --- x(t) plot
    const xtTraces = [
      {
        type: "scatter",
        mode: "lines",
        x: d.T_long,
        y: d.x_long,
        line: { width: 2.6 },
        name: "x(t)"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [d.t_cur],
        y: [d.x_now],
        marker: { size: 9, color: "#ffcc00", line: { color: "#222", width: 1.5 } },
        name: "t"
      }
    ];

    const xtLayout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 45 },
      xaxis: { title: "t (s)", range: [0, 10], showgrid: true, gridcolor: "#444" },
      yaxis: { title: "x(t)", showgrid: true, gridcolor: "#444" },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.4)" }
    };

    await Plotly.react("xtPlot", xtTraces, xtLayout, { responsive: true });

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

  // initialize slider UIs
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  syncValueLabels();
  await redraw();
}

main();