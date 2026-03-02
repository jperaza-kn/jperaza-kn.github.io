let py = null;
let seeds = []; // [{th0, om0}]
const baseColors = ["#a8e8ff", "#7fdcff", "#54cfff", "#31c4f0", "#2dbcc3", "#3bbf9f", "#4fc389", "#6acd76", "#8ee874", "#b5ff80"];

const TH_RANGE = [-2 * Math.PI, 2 * Math.PI];
const OM_RANGE = [-5, 5];

function fmt(x) { return Number(x).toFixed(2); }

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

  // expects ../../../assets/mathlets/pendulum.py
  await loadPythonFile(py, "../../../assets/mathlets/isoclines_pendulum.py");
}

async function computeFigureData(a, b) {
  py.globals.set("A", a);
  py.globals.set("B", b);

  // Vector field
  py.globals.set("TH0", TH_RANGE[0]);
  py.globals.set("TH1", TH_RANGE[1]);
  py.globals.set("OM0", OM_RANGE[0]);
  py.globals.set("OM1", OM_RANGE[1]);

  const vf = py.runPython(`
xs, ys = slope_field(A, B, th_range=(TH0, TH1), om_range=(OM0, OM1), n=20, scale=0.5)
(xs, ys)
  `).toJs();

  const [xs, ys] = vf;

  const traces = [];

  traces.push({
    type: "scatter",
    mode: "lines",
    x: xs, y: ys,
    line: { width: 1.1, color: "#888888" },
    name: "vector field"
  });

  // Trajectories
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    py.globals.set("th0", s.th0);
    py.globals.set("om0", s.om0);

    const resF = py.runPython(`rk4_path(A, B, th0, om0, 20.0, h=0.02, clip=6.0)`).toJs();
    const resB = py.runPython(`rk4_path(A, B, th0, om0, -20.0, h=0.02, clip=6.0)`).toJs();

    const [thF, omF] = resF;
    const [thB, omB] = resB;

    const th = thB.slice().reverse().concat(thF.slice(1));
    const om = omB.slice().reverse().concat(omF.slice(1));

    const color = baseColors[i % baseColors.length];

    traces.push({
      type: "scatter",
      mode: "lines",
      x: th, y: om,
      line: { width: 2.5, color },
      name: `Trajectory ${i + 1}`
    });

    // marker for initial condition
    traces.push({
      type: "scatter",
      mode: "markers",
      x: [s.th0], y: [s.om0],
      marker: { size: 9, color, line: { color: "#000", width: 1.5 } },
      showlegend: false,
      hoverinfo: "skip"
    });
  }

  return traces;
}

async function redraw() {
  try {
    clearErr();

    const a = Number(document.getElementById("a").value);
    const b = Number(document.getElementById("b").value);

    document.getElementById("aVal").textContent = fmt(a);
    document.getElementById("bVal").textContent = fmt(b);

    const traces = await computeFigureData(a, b);

    const layout = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 55 },
      xaxis: {
        range: TH_RANGE,
        title: "θ",
        showgrid: true,
        gridcolor: "#444",
        zeroline: false
      },
      yaxis: {
        range: OM_RANGE,
        title: "ω",
        showgrid: true,
        gridcolor: "#444",
        zeroline: false
      },
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

async function main() {
  await initPyodideAndModule();

  renderSeeds();
  await redraw();

  ["a", "b"].forEach(id => {
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
    seeds.push({ th0: pt.x, om0: pt.y });
    renderSeeds();
    redraw();
  });

  // (optional) scroll-safe: if you re-render MathJax content dynamically later
  // MathJax.typesetPromise?.();
}

// Language toggle
const langBtn = document.getElementById("langToggle");
const textES = document.getElementById("text-es");
const textEN = document.getElementById("text-en");

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

  // re-typeset math (important for MathJax)
  if (window.MathJax) {
    MathJax.typesetPromise();
  }
});

main();