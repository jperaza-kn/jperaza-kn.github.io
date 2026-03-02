let py = null;
let seeds = []; // [{x0,y0}]
const baseColors = ["#a8e8ff", "#7fdcff", "#54cfff", "#31c4f0", "#2dbcc3", "#3bbf9f", "#4fc389", "#6acd76", "#8ee874", "#b5ff80"];

const X_RANGE = [-4, 4];
const Y_RANGE = [-4, 4];

function fmt(x) { return Number(x).toFixed(2); }

// ------------------ seeds UI ------------------

function renderSeeds() {
  const box = document.getElementById("solutions");
  box.innerHTML = "";
  if (!seeds.length) {
    const msg = document.createElement("div");
    msg.style.color = "var(--muted)";
    msg.textContent = "Click on the plot to add a trajectory.";
    box.appendChild(msg);
    return;
  }
  seeds.forEach((s, i) => {
    const b = document.createElement("button");
    b.className = "solbtn";
    b.textContent = `Trajectory ${i + 1} ✖`;
    b.addEventListener("click", () => {
      seeds = seeds.filter((_, j) => j !== i);
      renderSeeds();
      redraw();
    });
    box.appendChild(b);
  });
}

// ------------------ errors ------------------

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

// ------------------ pyodide ------------------

async function initPyodideAndModule() {
  py = await initPyodideBase({
    packages: ["numpy"],
    stderr: (s) => console.log("[pyodide]", s)
  });

  // expects this python file:
  // ../../../assets/mathlets/2d_systems_gauss.py
  await loadPythonFile(py, "../../../assets/mathlets/2d_systems_gauss.py");
}

function getParams() {
  return {
    f: Number(document.getElementById("f").value),
    e: Number(document.getElementById("e").value),
    d1: Number(document.getElementById("d1").value),
    d2: Number(document.getElementById("d2").value),
  };
}

async function computeFigureData({ e, f, d1, d2 }) {
  py.globals.set("E", e);
  py.globals.set("F", f);
  py.globals.set("D1", d1);
  py.globals.set("D2", d2);

  // slope field
  py.globals.set("X0", X_RANGE[0]);
  py.globals.set("X1", X_RANGE[1]);
  py.globals.set("Y0", Y_RANGE[0]);
  py.globals.set("Y1", Y_RANGE[1]);

  const outVF = py.runPython(`
xsf, ysf = slope_field(E, F, D1, D2, x_range=(X0, X1), y_range=(Y0, Y1), n=20, scale=0.4)
(xsf, ysf)
  `).toJs();

  const [xsf, ysf] = outVF;

  const traces = [];

  traces.push({
    type: "scatter",
    mode: "lines",
    x: xsf, y: ysf,
    line: { width: 1.1, color: "#888888" },
    name: "vector field"
  });

  // trajectories
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const color = baseColors[i % baseColors.length];

    py.globals.set("x0", s.x0);
    py.globals.set("y0", s.y0);

    const resF = py.runPython(`rk4_path(E, F, D1, D2, x0, y0, 10.0, h=0.02, clip=10.0)`).toJs();
    const resB = py.runPython(`rk4_path(E, F, D1, D2, x0, y0, -10.0, h=0.02, clip=10.0)`).toJs();

    const [xf, yf] = resF;
    const [xb, yb] = resB;

    const xx = xb.slice().reverse().concat(xf.slice(1));
    const yy = yb.slice().reverse().concat(yf.slice(1));

    traces.push({
      type: "scatter",
      mode: "lines",
      x: xx, y: yy,
      line: { width: 2.2, color },
      name: `Trajectory ${i + 1}`
    });

    // initial condition marker
    traces.push({
      type: "scatter",
      mode: "markers",
      x: [s.x0], y: [s.y0],
      marker: { size: 9, color, line: { color: "#000", width: 1.2 } },
      showlegend: false,
      hoverinfo: "skip"
    });

    // arrows at t = ±0.5
    for (const tArrow of [-0.5, 0.5]) {
      py.globals.set("tA", tArrow);
      const arr = py.runPython(`arrow_at_time(E, F, D1, D2, x0, y0, tA)`).toJs();
      const [ax, ay] = arr;

      if (ax && ax.length >= 3) {
        traces.push({
          type: "scatter",
          mode: "lines",
          x: ax, y: ay,
          line: { width: 2.0, color },
          showlegend: false,
          hoverinfo: "skip"
        });
      }
    }
  }

  return traces;
}

// ------------------ plot ------------------

async function redraw() {
  try {
    clearErr();

    const { e, f, d1, d2 } = getParams();

    document.getElementById("fVal").textContent = fmt(f);
    document.getElementById("eVal").textContent = fmt(e);
    document.getElementById("d1Val").textContent = fmt(d1);
    document.getElementById("d2Val").textContent = fmt(d2);

    const traces = await computeFigureData({ e, f, d1, d2 });

    const layout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: { range: X_RANGE, title: "x", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { range: Y_RANGE, title: "y", showgrid: true, gridcolor: "#444", zeroline: false },
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

// ------------------ slider UI ------------------

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

// ------------------ language toggle ------------------

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

// ------------------ main ------------------

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  renderSeeds();
  await redraw();

  ["f", "e", "d1", "d2"].forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  const plotDiv = document.getElementById("plot");
  plotDiv.on("plotly_click", (ev) => {
    const pt = ev?.points?.[0];
    if (!pt) return;
    seeds.push({ x0: pt.x, y0: pt.y });
    renderSeeds();
    redraw();
  });
}

main();