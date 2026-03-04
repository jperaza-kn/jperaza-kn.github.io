
let py = null;

function fmt(x, d=3){ return Number(x).toFixed(d); }

function showErr(e){
  const box = document.getElementById("errBox");
  if(!box) return;
  box.style.display = "block";
  box.textContent = (e && e.stack) ? e.stack : String(e);
}
function clearErr(){
  const box = document.getElementById("errBox");
  if(!box) return;
  box.style.display = "none";
  box.textContent = "";
}

function updateDashSliderUI(input){
  const min = Number(input.min);
  const max = Number(input.max);
  const val = Number(input.value);
  const pct = ((val - min) / (max - min)) * 100;

  const wrap = input.closest(".slider-wrap");
  if(!wrap) return;
  wrap.style.setProperty("--fill", String(pct));

  const ticks = wrap.querySelectorAll(".dash-tick");
  ticks.forEach(t => {
    const pStr = t.style.getPropertyValue("--p").trim();
    const p = Number(pStr.replace("%",""));
    t.classList.toggle("active", p <= pct + 1e-9);
  });
}

async function initPy(){
  py = await initPyodideBase({
    packages: ["numpy"],
    stderr: (s) => console.log("[pyodide]", s)
  });

  try{
    await loadPythonFile(py, "./schrodinger_barrier.py");
    console.log("[sch] loaded ./schrodinger_barrier.py");
  }catch(e1){
    console.warn("[sch] failed local load, trying assets path", e1);
    await loadPythonFile(py, "../../../assets/mathlets/schrodinger_barrier.py");
    console.log("[sch] loaded ../../../assets/mathlets/schrodinger_barrier.py");
  }
}

async function compute(a, V0, phase){
  py.globals.set("a", a);
  py.globals.set("V0", V0);
  py.globals.set("phase", phase);

  const out = py.runPython(`compute_plot_data(a, V0, phase)`);
  return out.toJs(); // [X, P, Vplot, meta]
}

async function redraw(){
  try{
    clearErr();

    const a = Number(document.getElementById("a").value);
    const V0 = Number(document.getElementById("V0").value);
    const phase = Number(document.getElementById("phase").value);

    document.getElementById("aVal").textContent = fmt(a, 2);
    document.getElementById("V0Val").textContent = fmt(V0, 2);
    document.getElementById("phVal").textContent = fmt(phase, 2);

    const [X, P, Vplot, meta] = await compute(a, V0, phase);

    // meta readout
    const m = meta;
    const info = document.getElementById("meta");
    if(info){
      const k0 = m.k0 ?? 0;
      const k1re = m.k1_re ?? 0;
      const k1im = m.k1_im ?? 0;
      const kappa = m.kappa ?? 0;
      const regime = (k1im !== 0) ? "E < V0 (evanescent)" : "E ≥ V0 (oscillatory)";
      info.textContent =
        `E=${fmt(m.E,2)} | ${regime} | k0=${fmt(k0,3)} | k1=${fmt(k1re,3)}+i${fmt(k1im,3)} | kappa=${fmt(kappa,3)} | barrier=[${fmt(m.x0,2)}, ${fmt(m.x1,2)}] | x-shift=${fmt(m.x_shift,2)}`;
    }

    const traces = [
      {
        type: "scatter",
        mode: "lines",
        x: X, y: P,
        line: { width: 2.8 },
        name: "|ψ(x)|²"
      },
      {
        type: "scatter",
        mode: "lines",
        x: X, y: Vplot,
        line: { width: 2.0, dash: "dot" },
        opacity: 0.55,
        name: "V(x) (scaled)"
      }
    ];

    const layout = {
      template: "plotly_dark",
      margin: { l: 60, r: 12, t: 10, b: 55 },
      xaxis: {
        title: "x",
        showgrid: true,
        gridcolor: "#444",
        zeroline: false,
      },
      yaxis: {
        title: "|ψ(x)|²",
        showgrid: true,
        gridcolor: "#444",
        zeroline: false,
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plot", traces, layout, {responsive: true});
  }catch(e){
    showErr(e);
    console.error(e);
  }
}

function setupLanguageToggle(){
  const langBtn = document.getElementById("langToggle");
  const textES = document.getElementById("text-es");
  const textEN = document.getElementById("text-en");
  if(!langBtn || !textES || !textEN) return;

  let current = "es";
  langBtn.addEventListener("click", () => {
    if(current === "es"){
      textES.style.display = "none";
      textEN.style.display = "block";
      langBtn.textContent = "Español";
      current = "en";
    }else{
      textEN.style.display = "none";
      textES.style.display = "block";
      langBtn.textContent = "English";
      current = "es";
    }
    if(window.MathJax) MathJax.typesetPromise();
  });
}

async function main(){
  setupLanguageToggle();
  await initPy();

  const ids = ["a","V0","phase"];
  ids.forEach(id => updateDashSliderUI(document.getElementById(id)));

  ids.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  await redraw();
}

main();
