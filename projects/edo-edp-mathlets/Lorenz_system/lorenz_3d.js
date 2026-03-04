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

  // Robust: try local folder first, then shared assets folder.
  try {
    await loadPythonFile(py, "./lorenz_3d.py");
    console.log("[lorenz] loaded ./lorenz_3d.py");
  } catch (e1) {
    console.warn("[lorenz] failed loading ./lorenz_3d.py, trying assets path...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/lorenz_3d.py");
    console.log("[lorenz] loaded ../../../assets/mathlets/lorenz_3d.py");
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

async function computeTrajectory(params) {
  py.globals.set("sigma", params.sigma);
  py.globals.set("rho", params.rho);
  py.globals.set("beta", params.beta);
  py.globals.set("x0", params.x0);
  py.globals.set("y0", params.y0);
  py.globals.set("z0", params.z0);
  py.globals.set("tmax", params.tmax);
  py.globals.set("dt", params.dt);

  const out = py.runPython(`
compute_plot_data(sigma, rho, beta, x0, y0, z0, tmax, dt)
  `);

  return out.toJs();
}

async function redraw() {
  try {
    clearErr();

    const sigma = Number(document.getElementById("sigma").value);
    const rho = Number(document.getElementById("rho").value);
    const beta = Number(document.getElementById("beta").value);

    const x0 = Number(document.getElementById("x0").value);
    const y0 = Number(document.getElementById("y0").value);
    const z0 = Number(document.getElementById("z0").value);

    const tmax = Number(document.getElementById("tmax").value);
    const dt = Number(document.getElementById("dt").value);

    document.getElementById("sigmaVal").textContent = fmt(sigma, 2);
    document.getElementById("rhoVal").textContent = fmt(rho, 2);
    document.getElementById("betaVal").textContent = fmt(beta, 2);

    document.getElementById("x0Val").textContent = fmt(x0, 2);
    document.getElementById("y0Val").textContent = fmt(y0, 2);
    document.getElementById("z0Val").textContent = fmt(z0, 2);

    document.getElementById("tmaxVal").textContent = fmt(tmax, 0);
    document.getElementById("dtVal").textContent = fmt(dt, 3);

    const [t, x, y, z, xmn, xmx, ymn, ymx, zmn, zmx] = await computeTrajectory({
      sigma, rho, beta, x0, y0, z0, tmax, dt
    });

    const trace3d = {
      type: "scatter3d",
      mode: "lines",
      x: x, y: y, z: z,
      line: { width: 3 },
      name: "trajectory"
    };

    const layout3d = {
      template: "plotly_dark",
      margin: { l: 0, r: 0, t: 0, b: 0 },
      scene: {
        xaxis: { title: "x", range: [xmn, xmx], showgrid: true, gridcolor: "#444", zeroline: false },
        yaxis: { title: "y", range: [ymn, ymx], showgrid: true, gridcolor: "#444", zeroline: false },
        zaxis: { title: "z", range: [zmn, zmx], showgrid: true, gridcolor: "#444", zeroline: false },
        bgcolor: "#1e1e1e"
      },
      paper_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      showlegend: false
    };

    await Plotly.react("plot3d", [trace3d], layout3d, { responsive: true });

    const tracesT = [
      { type: "scatter", mode: "lines", x: t, y: x, line: { width: 2.4 }, name: "x(t)" },
      { type: "scatter", mode: "lines", x: t, y: y, line: { width: 2.4 }, name: "y(t)" },
      { type: "scatter", mode: "lines", x: t, y: z, line: { width: 2.4 }, name: "z(t)" }
    ];

    const layoutT = {
      template: "plotly_dark",
      margin: { l: 55, r: 10, t: 10, b: 45 },
      xaxis: { title: "t", showgrid: true, gridcolor: "#444", zeroline: false },
      yaxis: { title: "value", showgrid: true, gridcolor: "#444", zeroline: false },
      paper_bgcolor: "#1e1e1e",
      plot_bgcolor: "#1e1e1e",
      font: { color: "#f0f0f0" },
      legend: { bgcolor: "rgba(0,0,0,0.35)" }
    };

    await Plotly.react("plotTime", tracesT, layoutT, { responsive: true });

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

  const sliderIds = ["sigma","rho","beta","x0","y0","z0","tmax","dt"];
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
