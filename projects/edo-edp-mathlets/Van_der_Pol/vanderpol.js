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
    await loadPythonFile(py, "./vanderpol.py");
    console.log("[vdp] loaded ./vanderpol.py");
  } catch (e1) {
    console.warn("[vdp] failed local load, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/vanderpol.py");
    console.log("[vdp] loaded ../../../assets/mathlets/vanderpol.py");
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

async function computeAll(mu, x0, y0) {
  py.globals.set("mu", mu);
  py.globals.set("x0", x0);
  py.globals.set("y0", y0);
  const out = py.runPython(`compute_plot_data(mu, x0, y0)`);
  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const mu = Number(document.getElementById("mu").value);
    const x0 = Number(document.getElementById("x0").value);
    const y0 = Number(document.getElementById("y0").value);

    document.getElementById("muVal").textContent = fmt(mu, 2);
    document.getElementById("x0Val").textContent = fmt(x0, 2);
    document.getElementById("y0Val").textContent = fmt(y0, 2);

    const [refs, main, ranges, YMIN, YMAX] = await computeAll(mu, x0, y0);

    const phaseTraces = [];
    for (const r of refs) {
      phaseTraces.push({
        type: "scatter",
        mode: "lines",
        x: r.x,
        y: r.y,
        line: { width: 1.2, color: "#8fe88f" },
        opacity: 0.65,
        hoverinfo: "skip",
        showlegend: false
      });
    }

    phaseTraces.push({
      type: "scatter",
      mode: "lines",
      x: main.x,
      y: main.y,
      line: { width: 2.8, color: "#1e7f1e" },
      showlegend: false
    });

    phaseTraces.push({
      type: "scatter",
      mode: "markers",
      x: [main.x[0]],
      y: [main.y[0]],
      marker: { size: 8, color: "#1e7f1e" },
      hovertemplate: "initial (x0,y0)<extra></extra>",
      showlegend: false
    });

    const phaseLayout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "x", range: [ranges.xmin, ranges.xmax], showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "y = x'", range: [ranges.ymin, ranges.ymax], showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plotPhase", phaseTraces, phaseLayout, { responsive: true });

    const timeTraces = [{
      type: "scatter",
      mode: "lines",
      x: main.t,
      y: main.x,
      line: { width: 2.6, color: "#1e7f1e" },
      showlegend: false
    }];

    const timeLayout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "t", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "x(t)", range: [YMIN, YMAX], showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plotTime", timeTraces, timeLayout, { responsive: true });

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

  const sliderIds = ["mu", "x0", "y0"];
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
