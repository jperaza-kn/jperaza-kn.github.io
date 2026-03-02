let py = null;
let seeds = []; // [{x0,y0,z0}]
const baseColors = ["#a8e8ff", "#7fdcff", "#54cfff", "#31c4f0", "#2dbcc3", "#3bbf9f", "#4fc389", "#6acd76", "#8ee874", "#b5ff80"];
const XYZ_RANGE = [-5, 5];

function fmt(x) { return Number(x).toFixed(2); }

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

  // expects ../../../assets/mathlets/2d_systems_gauss.py
  await loadPythonFile(py, "../../../assets/mathlets/3d_systems_1.py");
}

function getPars() {
  const ids = ["a11","a12","a13","a21","a22","a23","a31","a32","a33"];
  return ids.map(id => Number(document.getElementById(id).value));
}

function setValueLabels(pars) {
  const ids = ["a11","a12","a13","a21","a22","a23","a31","a32","a33"];
  ids.forEach((id, i) => {
    const el = document.getElementById(id + "Val");
    if (el) el.textContent = fmt(pars[i]);
  });
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

function renderSeeds() {
  const box = document.getElementById("solutions");
  box.innerHTML = "";
  if (!seeds.length) {
    const msg = document.createElement("div");
    msg.style.color = "var(--muted)";
    msg.textContent = "No trajectories yet.";
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

async function computeTraces(pars) {
  // set python globals
  py.globals.set("a11", pars[0]); py.globals.set("a12", pars[1]); py.globals.set("a13", pars[2]);
  py.globals.set("a21", pars[3]); py.globals.set("a22", pars[4]); py.globals.set("a23", pars[5]);
  py.globals.set("a31", pars[6]); py.globals.set("a32", pars[7]); py.globals.set("a33", pars[8]);

  // eigenvalues
  const ev = py.runPython(`eigvals_formatted(a11,a12,a13,a21,a22,a23,a31,a32,a33)`).toJs();

  // update eig panel text
  const eigText = document.getElementById("eigText");
  if (eigText) {
    eigText.innerHTML = `\\(\\lambda_1=${ev[0]},\\ \\lambda_2=${ev[1]},\\ \\lambda_3=${ev[2]}\\)`;
  }

  const traces = [];

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    py.globals.set("x0", s.x0);
    py.globals.set("y0", s.y0);
    py.globals.set("z0", s.z0);

    const resF = py.runPython(`rk4_path(a11,a12,a13,a21,a22,a23,a31,a32,a33, x0,y0,z0, 10.0, h=0.02, clip=10.0)`).toJs();
    const resB = py.runPython(`rk4_path(a11,a12,a13,a21,a22,a23,a31,a32,a33, x0,y0,z0, -10.0, h=0.02, clip=10.0)`).toJs();

    const [xf, yf, zf] = resF;
    const [xb, yb, zb] = resB;

    const xx = xb.slice().reverse().concat(xf.slice(1));
    const yy = yb.slice().reverse().concat(yf.slice(1));
    const zz = zb.slice().reverse().concat(zf.slice(1));

    const color = baseColors[i % baseColors.length];

    traces.push({
      type: "scatter3d",
      mode: "lines",
      x: xx, y: yy, z: zz,
      line: { width: 4, color },
      name: `Trajectory ${i + 1}`
    });

    traces.push({
      type: "scatter3d",
      mode: "markers",
      x: [s.x0], y: [s.y0], z: [s.z0],
      marker: { size: 5.8, color, line: { color: "#000", width: 1.2 } },
      showlegend: false,
      hoverinfo: "skip"
    });
  }

  return { traces, ev };
}

async function redraw() {
  try {
    clearErr();

    const pars = getPars();
    setValueLabels(pars);

    const { traces } = await computeTraces(pars);

    const layout = {
      template: "plotly_dark",
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.4)" },
      scene: {
        xaxis: { range: XYZ_RANGE, title: "x", showgrid: true, gridcolor: "#444", zeroline: true, zerolinecolor: "#777" },
        yaxis: { range: XYZ_RANGE, title: "y", showgrid: true, gridcolor: "#444", zeroline: true, zerolinecolor: "#777" },
        zaxis: { range: XYZ_RANGE, title: "z", showgrid: true, gridcolor: "#444", zeroline: true, zerolinecolor: "#777" },
        aspectmode: "cube",
        bgcolor: "#1e1e1e"
      }
    };

    await Plotly.react("plot", traces, layout, { responsive: true });

    // typeset eigenvalues + any latex labels
    if (window.MathJax) await MathJax.typesetPromise();

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

  // init slider visuals + events
  const sliderIds = ["a11","a12","a13","a21","a22","a23","a31","a32","a33"];
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  // add trajectory button
  document.getElementById("addTraj").addEventListener("click", () => {
    const x0 = Number(document.getElementById("x0").value);
    const y0 = Number(document.getElementById("y0").value);
    const z0 = Number(document.getElementById("z0").value);
    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(z0)) return;
    seeds.push({ x0, y0, z0 });
    renderSeeds();
    redraw();
  });

  renderSeeds();
  await redraw();
}

main();