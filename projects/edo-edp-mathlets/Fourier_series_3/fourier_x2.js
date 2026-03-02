let py = null;

function fmtInt(x) { return String(parseInt(x, 10)); }

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

  // expects: ../../../assets/mathlets/fourier-x2.py
  await loadPythonFile(py, "../../../assets/mathlets/fourier_x2.py");
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

async function computeData(N) {
  py.globals.set("N", Number(N));
  const out = py.runPython(`compute_series_data(int(N))`);
  return out.toJs(); // [x, f, s]
}

async function redraw() {
  try {
    clearErr();

    const N = Number(document.getElementById("N").value);
    document.getElementById("NVal").textContent = fmtInt(N);

    const [x, f, s] = await computeData(N);

    const traces = [
      {
        type: "scatter",
        mode: "lines",
        x, y: f,
        line: { width: 2.0, color: "#1f77b4" },
        name: "f(x)"
      },
      {
        type: "scatter",
        mode: "lines",
        x, y: s,
        line: { width: 2.4, color: "#ff7f0e" },
        name: `S_${N}(x)`
      }
    ];

    const X_MIN = py.runPython("X_MIN");
    const X_MAX = py.runPython("X_MAX");

    const layout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { range: [X_MIN, X_MAX], title: "x", showgrid: true, gridcolor: "#444" },
      yaxis: { range: [-0.25, 1.25], title: "y", showgrid: true, gridcolor: "#444" },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.4)" }
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

  const slider = document.getElementById("N");
  updateDashSliderUI(slider);

  slider.addEventListener("input", () => {
    updateDashSliderUI(slider);
    redraw();
  });

  await redraw();
}

main();