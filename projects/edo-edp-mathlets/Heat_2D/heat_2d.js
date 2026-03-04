let py = null;
let running = false;
let timerId = null;

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

  // robust path: local first, then shared assets
  try {
    await loadPythonFile(py, "./heat_2d.py");
    console.log("[heat2d] loaded ./heat_2d.py");
  } catch (e1) {
    console.warn("[heat2d] failed loading ./heat_2d.py, trying assets...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/heat_2d.py");
    console.log("[heat2d] loaded ../../../assets/mathlets/heat_2d.py");
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

function getParams() {
  const a = Number(document.getElementById("a").value);
  const b = Number(document.getElementById("b").value);
  const c = Number(document.getElementById("c").value);
  const d = Number(document.getElementById("d").value);

  document.getElementById("aVal").textContent = fmt(a, 2);
  document.getElementById("bVal").textContent = fmt(b, 2);
  document.getElementById("cVal").textContent = fmt(c, 2);
  document.getElementById("dVal").textContent = fmt(d, 2);

  return { a, b, c, d };
}

async function resetSimulation() {
  const { a, b, c, d } = getParams();

  // (re)initialize state
  py.globals.set("a", a);
  py.globals.set("b", b);
  py.globals.set("c", c);
  py.globals.set("d", d);

  // Keep these modest for responsiveness
  py.globals.set("N", 61);
  // Smaller visual run window (t in [0,2]) and slower animation.
  // Keep dt moderate for ADI stability + responsiveness.
  py.globals.set("dt", 0.0025);

  py.runPython(`reset_state(a,b,c,d,N=N,dt=dt)`);
  await redraw();
}

async function getPlotData() {
  const out = py.runPython(`get_plot_data()`);
  return out.toJs(); // [X, Y, U, t, zmin, zmax]
}

async function redraw() {
  try {
    clearErr();
    const [X, Y, U, t, zmin, zmax] = await getPlotData();
    document.getElementById("tVal").textContent = fmt(t, 2);

    const surface = {
      type: "surface",
      x: X,
      y: Y,
      z: U,
      showscale: false,
      opacity: 0.95
    };

    const layout = {
      template: "plotly_dark",
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        xaxis: { title: "x", range: [0, 1], gridcolor: "#444", zeroline: false },
        yaxis: { title: "y", range: [0, 1], gridcolor: "#444", zeroline: false },
        zaxis: { title: "u", range: [zmin, zmax], gridcolor: "#444", zeroline: false },
        aspectmode: "cube",
        camera: { eye: { x: 1.6, y: 1.3, z: 0.9 } }
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plotTop", [surface], layout, { responsive: true });

    // Contour plot below
    // NOTE: Python returns X,Y,U as meshgrids with shape (nx, ny) using indexing='ij'.
    // Plotly contour expects z with rows corresponding to y and columns to x when x,y are 1D.
    // So we extract xvec, yvec and transpose U.
    const xvec = X.map(row => row[0]);      // xref
    const yvec = Y[0];                      // yref
    const Ut = U[0].map((_, j) => U.map(row => row[j])); // transpose -> (ny, nx)

    const contour = {
      type: "contour",
      x: xvec,
      y: yvec,
      z: Ut,
      contours: {
        coloring: "heatmap",
        showlines: true,
        start: zmin,
        end: zmax,
        size: (zmax - zmin) / 18
      },
      line: { width: 1 },
      showscale: true,
      colorbar: { len: 0.8 }
    };

    const layout2 = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 45 },
      xaxis: { title: "x", range: [0, 1], gridcolor: "#444", zeroline: false },
      yaxis: { title: "y", range: [0, 1], gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plotBottom", [contour], layout2, { responsive: true });

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

async function stepAndRedraw(nsteps) {
  py.globals.set("nsteps", nsteps);
  py.runPython(`step_state(nsteps)`);
  await redraw();
}

function stopRun() {
  running = false;
  const btn = document.getElementById("startBtn");
  if (btn) btn.textContent = "Start";
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startRun() {
  if (running) return;
  running = true;
  const btn = document.getElementById("startBtn");
  if (btn) btn.textContent = "Stop";

  // advance until t >= 2
  timerId = setInterval(async () => {
    try {
      // 1 step per frame -> 0.01 time units per frame (dt=0.0025)
      // With 150ms interval, the evolution is intentionally slower.
      await stepAndRedraw(1);

      const t = Number(document.getElementById("tVal").textContent);
      if (t >= 2.0 - 1e-9) {
        stopRun();
      }
    } catch (e) {
      stopRun();
      showErr(e);
    }
  }, 150);
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

  // init slider UI state
  const sliderIds = ["a","b","c","d"];
  sliderIds.forEach(id => updateDashSliderUI(document.getElementById(id)));

  // listeners: changing params stops run + resets simulation
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", async () => {
      updateDashSliderUI(el);
      stopRun();
      await resetSimulation();
    });
  });

  const startBtn = document.getElementById("startBtn");
  startBtn.addEventListener("click", async () => {
    if (!running) startRun();
    else stopRun();
  });

  const resetBtn = document.getElementById("resetBtn");
  resetBtn.addEventListener("click", async () => {
    stopRun();
    await resetSimulation();
  });

  await resetSimulation();
}

main();
