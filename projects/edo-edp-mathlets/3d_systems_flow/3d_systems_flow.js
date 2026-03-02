let py = null;

const sliderIds = ["a11","a12","a13","a21","a22","a23","a31","a32","a33","T"];

function fmt2(x) { return Number(x).toFixed(2); }

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

  await loadPythonFile(py, "../../../assets/mathlets/3d_systems_flow.py");
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

function getPars() {
  // 9 matrix entries in row-major order
  return [
    Number(document.getElementById("a11").value),
    Number(document.getElementById("a12").value),
    Number(document.getElementById("a13").value),
    Number(document.getElementById("a21").value),
    Number(document.getElementById("a22").value),
    Number(document.getElementById("a23").value),
    Number(document.getElementById("a31").value),
    Number(document.getElementById("a32").value),
    Number(document.getElementById("a33").value),
  ];
}

function syncValueLabels() {
  const pairs = [
    ["a11","a11Val"],["a12","a12Val"],["a13","a13Val"],
    ["a21","a21Val"],["a22","a22Val"],["a23","a23Val"],
    ["a31","a31Val"],["a32","a32Val"],["a33","a33Val"],
    ["T","TVal"],
  ];
  for (const [sid, vid] of pairs) {
    const v = Number(document.getElementById(sid).value);
    document.getElementById(vid).textContent = fmt2(v);
  }
}

async function computeTraces(pars, T, forwardOnly, showEig) {
  py.globals.set("pars", pars);
  py.globals.set("T", Number(T));
  py.globals.set("forward_only", Boolean(forwardOnly));
  py.globals.set("show_eig", Boolean(showEig));

  const out = py.runPython(`
traces, eig_info, eig_shown = compute_flow_traces(pars, T, forward_only=forward_only, show_eig=show_eig)
(traces, eig_info, eig_shown)
  `);

  return out.toJs(); // [traces, eig_info, eig_shown]
}

async function redraw() {
  try {
    clearErr();

    const pars = getPars();
    const T = Number(document.getElementById("T").value);
    const forwardOnly = document.getElementById("forwardOnly").checked;
    const showEig = document.getElementById("showEig").checked;

    syncValueLabels();

    const [traces, eigInfo] = await computeTraces(pars, T, forwardOnly, showEig);

    // Layout matches your Dash look
    const layout = {
      template: "plotly_dark",
      margin: { l: 0, r: 0, t: 0, b: 0 },
      paper_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      showlegend: false,
      scene: {
        xaxis: { range: [-4, 4], title: "x", showgrid: true, gridcolor: "#444" },
        yaxis: { range: [-4, 4], title: "y", showgrid: true, gridcolor: "#444" },
        zaxis: { range: [-4, 4], title: "z", showgrid: true, gridcolor: "#444" },
        aspectmode: "cube",
        bgcolor: "#1e1e1e",
      }
    };

    await Plotly.react("plot", traces, layout, { responsive: true });

    // eigen info panel
    const eigBox = document.getElementById("eigInfo");
    eigBox.textContent = eigInfo;

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

  // init slider UI + listeners
  sliderIds.forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  // checkbox listeners
  document.getElementById("forwardOnly").addEventListener("change", redraw);
  document.getElementById("showEig").addEventListener("change", redraw);

  // initial labels
  syncValueLabels();

  await redraw();
}

main();