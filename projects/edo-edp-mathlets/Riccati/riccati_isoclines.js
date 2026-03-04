let py = null;

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

function fmt(x, d=2){ return Number(x).toFixed(d); }

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

async function initPy() {
  py = await initPyodideBase({
    packages: ["numpy", "sympy"],
    stderr: (s) => console.log("[pyodide]", s),
  });

  // robust load: local first, then shared assets
  try {
    await loadPythonFile(py, "./riccati_isoclines.py");
    console.log("[riccati] loaded ./riccati_isoclines.py");
  } catch (e1) {
    console.warn("[riccati] failed local load, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/riccati_isoclines.py");
    console.log("[riccati] loaded ../../../assets/mathlets/riccati_isoclines.py");
  }
}

function getParams() {
  const A = document.getElementById("Aexpr").value.trim() || "0";
  const B = document.getElementById("Bexpr").value.trim() || "0";
  const C = document.getElementById("Cexpr").value.trim() || "0";

  const m = Number(document.getElementById("m").value);
  const x0 = Number(document.getElementById("x0").value);
  const y0 = Number(document.getElementById("y0").value);

  const x_min = -2, x_max = 2, y_min = -2, y_max = 2;

  return {A, B, C, m, x0, y0, x_min, x_max, y_min, y_max};
}

async function computeField() {
  const p = getParams();
  py.globals.set("A_expr", p.A);
  py.globals.set("B_expr", p.B);
  py.globals.set("C_expr", p.C);
  py.globals.set("x_min", p.x_min);
  py.globals.set("x_max", p.x_max);
  py.globals.set("y_min", p.y_min);
  py.globals.set("y_max", p.y_max);
  py.globals.set("mval", p.m);

  const out = py.runPython(`
compute_field(A_expr, B_expr, C_expr, x_min, x_max, y_min, y_max, nx=41, ny=41, seglen=0.12, m=mval)
  `);
  return out.toJs(); // [xs, ys, F, segs]
}

async function solveFromIC() {
  const p = getParams();

  py.globals.set("A_expr", p.A);
  py.globals.set("B_expr", p.B);
  py.globals.set("C_expr", p.C);
  py.globals.set("x0", p.x0);
  py.globals.set("y0", p.y0);
  py.globals.set("x_min", p.x_min);
  py.globals.set("x_max", p.x_max);

  const out = py.runPython(`
solve_curve(A_expr, B_expr, C_expr, x0, y0, x_min, x_max, h=0.01, y_clip=50.0)
  `);
  return out.toJs(); // [xs, ys]
}

let solutionTraces = []; // {id, trace}
let solCounter = 0;

function buildSlopeTrace(segs) {
  // Build one big "lines" trace using null separators
  const xs = [];
  const ys = [];
  for (const s of segs) {
    xs.push(s[0], s[1], null);
    ys.push(s[2], s[3], null);
  }
  return {
    type: "scatter",
    mode: "lines",
    x: xs,
    y: ys,
    line: { width: 1.0, color: "rgba(180,180,180,0.45)" },
    hoverinfo: "skip",
    name: "field",
    showlegend: false,
  };
}

function buildIsoclineTrace(xs, ys, F) {
  // Plotly contour expects z as (len(y), len(x)) matching y rows, x cols.
  // Here F already comes from meshgrid with indexing="xy" => F[j][i] corresponds to ys[j], xs[i]
  return {
    type: "contour",
    x: xs,
    y: ys,
    z: F,
    contours: {
      start: 0,
      end: 0,
      size: 1,
      coloring: "none",
      showlabels: false
    },
    line: { color: "orange", width: 3 },
    hoverinfo: "skip",
    name: "isocline",
    showscale: false,
  };
}

function layoutBase() {
  return {
    template: "plotly_dark",
    margin: { l: 55, r: 10, t: 10, b: 55 },
    xaxis: { title: "x", range: [-2, 2], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
    yaxis: { title: "y", range: [-2, 2], showgrid: true, gridcolor: "#444", zeroline: false, autorange: false },
    paper_bgcolor: "#1e1e1e",
    plot_bgcolor: "#1e1e1e",
    font: { color: "#f0f0f0" },
    legend: { bgcolor: "rgba(0,0,0,0.35)" }
  };
}

async function redraw() {
  try {
    clearErr();

    const m = Number(document.getElementById("m").value);
    document.getElementById("mVal").textContent = fmt(m, 2);

    const [xs, ys, F, segs] = await computeField();

    const traces = [
      buildSlopeTrace(segs),
      buildIsoclineTrace(xs, ys, F),
      ...solutionTraces.map(s => s.trace)
    ];

    await Plotly.react("plot", traces, layoutBase(), { responsive: true });
    if (window.MathJax) MathJax.typesetPromise();

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

function addSolutionToLegendUI(id, label) {
  const box = document.getElementById("solutions");
  if (!box) return;

  const row = document.createElement("div");
  row.className = "solrow";
  row.dataset.sid = String(id);

  const name = document.createElement("span");
  name.className = "solname";
  name.textContent = label;

  const del = document.createElement("button");
  del.className = "solbtn";
  del.textContent = "delete";
  del.addEventListener("click", () => {
    solutionTraces = solutionTraces.filter(s => s.id !== id);
    row.remove();
    redraw();
  });

  row.appendChild(name);
  row.appendChild(del);
  box.appendChild(row);
}

async function graphFromInputs() {
  try {
    clearErr();
    const [xs, ys] = await solveFromIC();

    const id = ++solCounter;
    const color = "rgba(46, 204, 113, 0.95)"; // dark green-ish
    const trace = {
      type: "scatter",
      mode: "lines",
      x: xs,
      y: ys,
      line: { width: 3, color },
      name: `solution #${id}`,
      hovertemplate: "x=%{x:.3f}<br>y=%{y:.3f}<extra></extra>"
    };

    solutionTraces.push({ id, trace });
    addSolutionToLegendUI(id, `IC: (x₀,y₀)=(${fmt(getParams().x0,2)}, ${fmt(getParams().y0,2)})`);

    await redraw();
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
  await initPy();

  // slider UI
  const mEl = document.getElementById("m");
  updateDashSliderUI(mEl);
  mEl.addEventListener("input", () => { updateDashSliderUI(mEl); redraw(); });

  // inputs (debounced-ish)
  ["Aexpr", "Bexpr", "Cexpr"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => redraw());
  });

  // IC inputs
  ["x0", "y0"].forEach(id => {
    document.getElementById(id).addEventListener("change", () => {});
  });

  document.getElementById("graphBtn").addEventListener("click", () => graphFromInputs());
  document.getElementById("clearBtn").addEventListener("click", () => {
    solutionTraces = [];
    const box = document.getElementById("solutions");
    if (box) box.innerHTML = "";
    redraw();
  });

  await redraw();
}

main();
