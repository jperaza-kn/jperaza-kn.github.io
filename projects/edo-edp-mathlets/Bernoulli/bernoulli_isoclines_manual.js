let py = null;

const state = { curves: [], curveCounter: 0 };

function fmt(x, d=2){ return Number(x).toFixed(d); }

function showErr(msg){
  const box = document.getElementById("errBox");
  box.style.display = "block";
  box.textContent = String(msg);
}
function clearErr(){
  const box = document.getElementById("errBox");
  box.style.display = "none";
  box.textContent = "";
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
    const p = Number(pStr.replace("%",""));
    t.classList.toggle("active", p <= pct + 1e-9);
  });
}

function setupLanguageToggle(){
  const btn = document.getElementById("langToggle");
  const es = document.getElementById("text-es");
  const en = document.getElementById("text-en");
  if (!btn || !es || !en) return;

  let lang = "es";
  btn.addEventListener("click", () => {
    if (lang === "es"){
      es.style.display = "none";
      en.style.display = "block";
      btn.textContent = "Español";
      lang = "en";
    } else {
      en.style.display = "none";
      es.style.display = "block";
      btn.textContent = "English";
      lang = "es";
    }
    if (window.MathJax) MathJax.typesetPromise();
  });
}

async function initPy(){
  py = await initPyodideBase({ packages: ["numpy", "sympy"] });

  try {
    await loadPythonFile(py, "./bernoulli_isoclines.py");
    console.log("[bern] loaded ./bernoulli_isoclines.py");
  } catch (e1) {
    console.warn("[bern] failed loading ./bernoulli_isoclines.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/bernoulli_isoclines.py");
    console.log("[bern] loaded assets bernoulli_isoclines.py");
  }
}

function getInputs(){
  const A = document.getElementById("Aexpr").value;
  const B = document.getElementById("Bexpr").value;
  const n = document.getElementById("nValInput").value;
  const m = Number(document.getElementById("m").value);
  return {A, B, n, m};
}

function getICInputs(){
  const x0 = Number(document.getElementById("x0Input").value);
  const y0 = Number(document.getElementById("y0Input").value);
  return {x0, y0};
}

async function computeField(){
  const {A, B, n, m} = getInputs();
  py.globals.set("A_str", A);
  py.globals.set("B_str", B);
  py.globals.set("n", n);
  py.globals.set("m", m);
  const out = py.runPython(`compute_field_data(A_str, B_str, n, m)`);
  return out.toJs();
}

function baseLayout(){
  return {
    template: "plotly_dark",
    margin: {l: 55, r: 10, t: 10, b: 55},
    paper_bgcolor: "#1e1e1e",
    plot_bgcolor: "#1e1e1e",
    font: {color: "#f0f0f0"},
    xaxis: {title: "x", range: [-3, 3], showgrid: true, gridcolor: "#444", zeroline:false, autorange:false},
    yaxis: {title: "y", range: [-3, 3], showgrid: true, gridcolor: "#444", zeroline:false, autorange:false},
    showlegend: false
  };
}

async function redrawBase(){
  try{
    clearErr();
    const m = Number(document.getElementById("m").value);
    document.getElementById("mVal").textContent = fmt(m, 2);

    const [xvec, yvec, Ziso, segx, segy] = await computeField();

    const slopeTrace = {
      type: "scatter",
      mode: "lines",
      x: segx,
      y: segy,
      line: {width: 1},
      opacity: 0.35,
      hoverinfo: "skip"
    };

    // Single isocline f(x,y)=m drawn as a contour line Ziso=0.
    // Make it orange and ensure NO filled regions.
    const isoTrace = {
      type: "contour",
      x: xvec,
      y: yvec,
      z: Ziso,
      contours: { start: 0, end: 0, size: 1, coloring: "lines" },
      line: { width: 3, color: "orange" },
      showscale: false,
      hoverinfo: "skip"
    };

    // Add a sparse invisible scatter layer so plotly_click has something to click on (optional).
    // This doesn't always fire when clicking "empty space", hence the manual IC controls below.
    const clickLayer = {
      type: "scatter",
      mode: "markers",
      x: xvec.flatMap(x => yvec.map(() => x)),
      y: yvec.flatMap(y => xvec.map(() => y)),
      marker: { size: 18, opacity: 0.001 },
      hoverinfo: "skip"
    };

    const data = [clickLayer, slopeTrace, isoTrace, ...state.curves.map(c => c.trace)];
    await Plotly.react("plot", data, baseLayout(), {responsive:true});

    bindPlotClick(); // rebind after react to be safe
  } catch(e){
    showErr(e && e.stack ? e.stack : String(e));
    console.error(e);
  }
}

async function addCurveAt(x0, y0){
  try{
    clearErr();
    const {A, B, n} = getInputs();
    py.globals.set("A_str", A);
    py.globals.set("B_str", B);
    py.globals.set("n", n);
    py.globals.set("x0", x0);
    py.globals.set("y0", y0);

    const out = py.runPython(`solve_curve(A_str, B_str, n, x0, y0)`);
    const [xs, ys] = out.toJs();

    const id = ++state.curveCounter;
    const trace = {
      type: "scatter",
      mode: "lines",
      x: xs,
      y: ys,
      line: {width: 3, color: "#14c414"}, // dark green
      name: `sol ${id}`
    };

    state.curves.push({id, trace});
    renderSolutionButtons();
    await redrawBase();
  } catch(e){
    showErr(e && e.stack ? e.stack : String(e));
    console.error(e);
  }
}

function renderSolutionButtons(){
  const box = document.getElementById("solutions");
  box.innerHTML = "";
  state.curves.forEach((c) => {
    const btn = document.createElement("button");
    btn.className = "solbtn";
    btn.textContent = `✖ sol ${c.id}`;
    btn.addEventListener("click", async () => {
      state.curves = state.curves.filter(k => k.id !== c.id);
      renderSolutionButtons();
      await redrawBase();
    });
    box.appendChild(btn);
  });
}

let clickBound = false;
function bindPlotClick(){
  const gd = document.getElementById("plot");
  if (!gd || clickBound === true || typeof gd.on !== "function") return;

  clickBound = true;
  gd.on("plotly_click", async (ev) => {
    try{
      if (!ev || !ev.points || !ev.points.length) return;
      const p = ev.points[0];
      const x0 = Number(p.x);
      const y0 = Number(p.y);
      if (!Number.isFinite(x0) || !Number.isFinite(y0)) return;
      await addCurveAt(x0, y0);
    } catch(e){
      showErr(e && e.stack ? e.stack : String(e));
    }
  });
}

async function graphFromManualIC(){
  const {x0, y0} = getICInputs();
  if (!Number.isFinite(x0) || !Number.isFinite(y0)){
    showErr("Please enter numeric x0 and y0.");
    return;
  }
  await addCurveAt(x0, y0);
}

async function main(){
  setupLanguageToggle();
  await initPy();

  const mSlider = document.getElementById("m");
  updateDashSliderUI(mSlider);

  mSlider.addEventListener("input", async () => {
    updateDashSliderUI(mSlider);
    await redrawBase();
  });

  document.getElementById("applyBtn").addEventListener("click", async () => {
    state.curves = [];
    renderSolutionButtons();
    await redrawBase();
  });

  document.getElementById("graphBtn").addEventListener("click", async () => {
    await graphFromManualIC();
  });

  // Enter key graphs too
  ["x0Input","y0Input"].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") await graphFromManualIC();
    });
  });

  await redrawBase();
  if (window.MathJax) MathJax.typesetPromise();
}

main();
