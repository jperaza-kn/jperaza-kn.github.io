let py = null;

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

  await loadPythonFile(py, "../../../assets/mathlets/double_pendulum.py");
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
  document.getElementById("thetaVal").textContent = fmt2(document.getElementById("theta").value);
  document.getElementById("phiVal").textContent = fmt2(document.getElementById("phi").value);
}

async function computeData(theta0, phi0) {
  py.globals.set("theta0", Number(theta0));
  py.globals.set("phi0", Number(phi0));
  const out = py.runPython(`compute_fig_data(theta0, phi0)`);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    // 1) Hard checks: Plotly + plot div must exist
    if (typeof Plotly === "undefined") {
      throw new Error("Plotly is not loaded. Check the Plotly <script> tag / network.");
    }

    const plotEl = document.getElementById("plot");
    if (!plotEl) {
      throw new Error('Plot target not found: expected <div id="plot"></div> in the HTML.');
    }

    // 2) Read inputs
    const theta0 = Number(document.getElementById("theta").value);
    const phi0 = Number(document.getElementById("phi").value);
    syncValueLabels();

    // 3) Compute data (Pyodide)
    if (!py) {
      throw new Error("Pyodide not initialized (py is null). Did initPyodideAndModule() run?");
    }

    const d = await computeData(theta0, phi0);

    // 4) Validate payload (helps catch python->js conversion issues)
    if (!d || !d.th_grid || !d.ph_grid || !d.Z || !d.ths || !d.phs) {
      throw new Error("computeData() returned an unexpected object. Missing keys for plotting.");
    }

    const traces = [
      {
        type: "contour",
        x: d.th_grid,
        y: d.ph_grid,
        z: d.Z,
        ncontours: 18,
        showscale: false,
        contours: { coloring: "none", showlines: true },
        line: { color: "#666", width: 1.0 },
        opacity: 0.85,
        name: "H(θ,φ,p=0)=V"
      },
      {
        type: "scatter",
        mode: "lines",
        x: d.ths,
        y: d.phs,
        line: { width: 3.0, color: "rgb(16,150,72)" },
        name: "(θ(t), φ(t))"
      },
      {
        type: "scatter",
        mode: "markers",
        x: [d.theta0],
        y: [d.phi0],
        marker: { size: 10, color: "#ffcc00", line: { color: "#222", width: 1.5 } },
        name: "IC"
      }
    ];

    const R = Math.PI;

    const layout = {
      template: "plotly_dark",
      height: 640,                 // <-- IMPORTANT: force same height as your CSS
      margin: { l: 65, r: 10, t: 10, b: 55 },
      xaxis: {
        title: "θ",
        range: [-R, R],
        showgrid: true,
        gridcolor: "#444",
        zeroline: false
      },
      yaxis: {
        title: "φ",
        range: [-R, R],
        showgrid: true,
        gridcolor: "#444",
        zeroline: false
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.4)" }
    };

    await Plotly.react(plotEl, traces, layout, { responsive: true });

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

  // sliders
  ["theta", "phi"].forEach(id => {
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