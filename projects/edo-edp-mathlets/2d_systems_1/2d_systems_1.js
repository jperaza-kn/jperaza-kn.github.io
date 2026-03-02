let py = null;

function fmt2(x) { return Number(x).toFixed(2); }
function fmtR(x) { return String(parseInt(x, 10)); }

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

  // expects: ../../../assets/mathlets/lattice-flow.py
  await loadPythonFile(py, "../../../assets/mathlets/2d_systems_1.py");
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

async function compute(a11, a12, a21, a22, R, T) {
  py.globals.set("a11", a11);
  py.globals.set("a12", a12);
  py.globals.set("a21", a21);
  py.globals.set("a22", a22);
  py.globals.set("R", Number(R));
  py.globals.set("T", T);

  const out = py.runPython(`
traces, md_es, md_en, XR, YR = compute_plot_and_md(a11, a12, a21, a22, int(R), float(T))
(traces, md_es, md_en, XR, YR)
  `);

  return out.toJs(); // [traces, md_es, md_en, XR, YR]
}

async function redraw() {
  try {
    clearErr();

    const a11 = Number(document.getElementById("a11").value);
    const a12 = Number(document.getElementById("a12").value);
    const a21 = Number(document.getElementById("a21").value);
    const a22 = Number(document.getElementById("a22").value);
    const R = Number(document.getElementById("R").value);
    const T = Number(document.getElementById("T").value);

    document.getElementById("a11Val").textContent = fmt2(a11);
    document.getElementById("a12Val").textContent = fmt2(a12);
    document.getElementById("a21Val").textContent = fmt2(a21);
    document.getElementById("a22Val").textContent = fmt2(a22);
    document.getElementById("RVal").textContent = fmtR(R);
    document.getElementById("TVal").textContent = fmt2(T);

    const [traces, mdES, mdEN, XR, YR] = await compute(a11, a12, a21, a22, R, T);

    // Right column
    document.getElementById("classif").innerHTML = mdES;
    document.getElementById("classif-en").innerHTML = mdEN;

    // Plotly layout: keep dark template to match other mathlets
    const layout = {
      template: "plotly_dark",
      margin: { l: 45, r: 15, t: 10, b: 45 },
      xaxis: { range: XR, title: "x", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: {
        range: YR, title: "y", showgrid: true, gridcolor: "#444", zeroline: false,
        scaleanchor: "x", scaleratio: 1
      },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      showlegend: false
    };

    await Plotly.react("plot", traces, layout, { responsive: true });

    // Typeset LaTeX in the right column
    if (window.MathJax) await MathJax.typesetPromise();

  } catch (e) {
    showErr(e);
    console.error(e);
  }
}

async function main() {
  setupLanguageToggle();
  await initPyodideAndModule();

  const ids = ["a11", "a12", "a21", "a22", "R", "T"];
  ids.forEach(id => {
    const el = document.getElementById(id);
    updateDashSliderUI(el);
    el.addEventListener("input", () => {
      updateDashSliderUI(el);
      redraw();
    });
  });

  await redraw();
}

main();