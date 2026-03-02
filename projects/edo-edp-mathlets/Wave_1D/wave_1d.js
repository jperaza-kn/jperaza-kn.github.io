let py = null;

function fmt(x, d = 2) { return Number(x).toFixed(d); }

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

  // Robust: try local folder first, then your shared assets folder.
  // Put wave_1d.py EITHER:
  //   (A) in the same folder as wave_1d.html (recommended), OR
  //   (B) in ../../../assets/mathlets/
  try {
    await loadPythonFile(py, "./wave_1d.py");
    console.log("[wave] loaded ./wave_1d.py");
  } catch (e1) {
    console.warn("[wave] failed loading ./wave_1d.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/wave_1d.py");
    console.log("[wave] loaded ../../../assets/mathlets/wave_1d.py");
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

async function computeProfile(params) {
  // params: {t, kappa, A, x0, sigma, show_modes}
  py.globals.set("t", params.t);
  py.globals.set("kappa", params.kappa);
  py.globals.set("A", params.A);
  py.globals.set("x0", params.x0);
  py.globals.set("sigma", params.sigma);
  py.globals.set("SHOW", params.show_modes ? 1 : 0);

  const out = py.runPython(`
compute_plot_data(t, kappa, A, x0, sigma, SHOW)
  `);

  return out.toJs();
  // returns:
  // [X, u, baseline, modes, L, Y_MIN, Y_MAX, c]
}

async function redraw() {
  try {
    clearErr();

    const show_modes = document.getElementById("show-modes").checked;

    const t = Number(document.getElementById("t").value);
    const kappa = Number(document.getElementById("kappa").value);
    const A = Number(document.getElementById("A").value);
    const x0 = Number(document.getElementById("x0").value);
    const sigma = Number(document.getElementById("sigma").value);

    // readouts
    document.getElementById("tVal").textContent = fmt(t, 1);
    document.getElementById("kVal").textContent = fmt(kappa, 2);
    document.getElementById("AVal").textContent = fmt(A, 2);
    document.getElementById("x0Val").textContent = fmt(x0, 2);
    document.getElementById("sigmaVal").textContent = fmt(sigma, 2);

    const [X, u, baseline, modes, L, Y_MIN, Y_MAX, c] = await computeProfile({
      t, kappa, A, x0, sigma, show_modes
    });

    // update computed speed readout
    const cEl = document.getElementById("cVal");
    if (cEl) cEl.textContent = fmt(c, 2);

    const traces = [
      {
        type: "scatter",
        mode: "lines",
        x: X, y: u,
        line: { width: 2.6 },
        name: `u(x,t=${t.toFixed(1)})`
      },
      {
        type: "scatter",
        mode: "lines",
        x: X, y: baseline,
        line: { width: 2.0, dash: "dash" },
        name: "baseline (0)"
      }
    ];

    if (modes && modes.length) {
      for (const m of modes) {
        const y_mode = m[0];
        const color = m[1];
        const name = m[2];
        traces.push({
          type: "scatter",
          mode: "lines",
          x: X, y: y_mode,
          line: { width: 1.4, color },
          name
        });
      }
    }

    const layout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "x", range: [0, L], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      yaxis: { title: "u(x,t)", range: [Y_MIN, Y_MAX], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plot", traces, layout, { responsive: true });

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

  // init slider UI state
  const sliderIds = ["t", "kappa", "A", "x0", "sigma"];
  sliderIds.forEach(id => updateDashSliderUI(document.getElementById(id)));

  // listeners
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  const show = document.getElementById("show-modes");
  show.addEventListener("change", () => redraw());

  await redraw();
}

main();