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

  // Robust loading: local folder first, then shared assets.
  try {
    await loadPythonFile(py, "./laplace_2d.py");
    console.log("[laplace] loaded ./laplace_2d.py");
  } catch (e1) {
    console.warn("[laplace] failed loading ./laplace_2d.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/laplace_2d.py");
    console.log("[laplace] loaded ../../../assets/mathlets/laplace_2d.py");
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

async function computeU(params) {
  py.globals.set("a", params.a);
  py.globals.set("b", params.b);
  py.globals.set("c", params.c);
  py.globals.set("d", params.d);

  // Modest defaults for browser speed
  py.globals.set("N", 61);
  py.globals.set("ITERS", 450);

  const out = py.runPython(`compute_plot_data(a, b, c, d, N=N, iters=ITERS)`);
  return out.toJs(); // [x, y, Z, zmin, zmax]
}

async function redraw() {
  try {
    clearErr();

    const a = Number(document.getElementById("a").value);
    const b = Number(document.getElementById("b").value);
    const c = Number(document.getElementById("c").value);
    const d = Number(document.getElementById("d").value);

    document.getElementById("aVal").textContent = fmt(a, 2);
    document.getElementById("bVal").textContent = fmt(b, 2);
    document.getElementById("cVal").textContent = fmt(c, 2);
    document.getElementById("dVal").textContent = fmt(d, 2);

    const [x, y, Z, zmin, zmax] = await computeU({ a, b, c, d });

    // --- 3D surface (top)
    const surf = [{
      type: "surface",
      x: x,
      y: y,
      z: Z,
      showscale: false,
      contours: { z: { show: true, usecolormap: true, highlightwidth: 1, project: { z: true } } }
    }];

    const layout3d = {
      template: "plotly_dark",
      margin: { l: 0, r: 0, t: 10, b: 0 },
      scene: {
        xaxis: { title: "x", range: [0, 1], showgrid: true, gridcolor: "#444", zeroline: false },
        yaxis: { title: "y", range: [0, 1], showgrid: true, gridcolor: "#444", zeroline: false },
        zaxis: { title: "u(x,y)", range: [zmin, zmax], showgrid: true, gridcolor: "#444", zeroline: false },
        aspectmode: "cube",
        camera: { eye: { x: 1.65, y: 1.45, z: 1.15 } }
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plot3d", surf, layout3d, { responsive: true });

    // --- 2D heatmap (bottom)
    const heat = [{
      type: "heatmap",
      x: x,
      y: y,
      z: Z,
      zmin: zmin,
      zmax: zmax,
      showscale: true,
      colorbar: { title: "u" }
    }];

    const layout2d = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { title: "x", range: [0, 1], showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "y", range: [0, 1], showgrid: true, gridcolor: "#444", zeroline: false, scaleanchor: "x", scaleratio: 1 },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" }
    };

    await Plotly.react("plot2d", heat, layout2d, { responsive: true });

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

  const sliderIds = ["a", "b", "c", "d"];
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
