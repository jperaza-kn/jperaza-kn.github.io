let py = null;
let seeds = []; // [{x0,y0}]
const baseColors = ["#a8e8ff", "#7fdcff", "#54cfff", "#31c4f0", "#2dbcc3", "#3bbf9f", "#4fc389", "#6acd76", "#8ee874", "#b5ff80"];

function fmt(x) { return Number(x).toFixed(2); }

function renderSeeds() {
    const box = document.getElementById("solutions");
    box.innerHTML = "";
    if (!seeds.length) {
        const msg = document.createElement("div");
        msg.style.color = "var(--muted)";
        msg.textContent = "Click on the plot to add a solution curve.";
        box.appendChild(msg);
        return;
    }
    seeds.forEach((s, i) => {
        const b = document.createElement("button");
        b.className = "solbtn";
        b.textContent = `Solution ${i + 1} ✖`;
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
    // use the new base loader
    py = await initPyodideBase({
        packages: ["numpy"],
        stderr: (s) => console.log("[pyodide]", s)
    });

    // use helper to load the python file
    await loadPythonFile(py, "../../../assets/mathlets/isoclines.py");
}

async function computeFigureData(a, m) {
    py.globals.set("A", a);
    py.globals.set("M", m);

    const out = py.runPython(`
        xsf, ysf = slope_field(A)
        xg, yg, Z  = isocline_grid(A)
        (xsf, ysf, xg, yg, Z)
        `);

    const [xsf, ysf, xg, yg, Z] = out.toJs();

    const traces = [];

    traces.push({
        type: "contour",
        x: xg, y: yg, z: Z,
        contours: { start: m - 0.1, end: m + 0.1, size: 0.5, coloring: "lines" },
        showscale: false,
        line: { width: 1, color: "#cccccc" },
        opacity: 0.5,
        name: "Nearby levels"
    });

    traces.push({
        type: "contour",
        x: xg, y: yg, z: Z,
        contours: { start: m, end: m, size: 1, coloring: "lines" },
        showscale: false,
        line: { width: 3, color: "#1677ff" },
        name: `Isocline f=m (${m.toFixed(2)})`
    });

    traces.push({
        type: "scatter",
        mode: "lines",
        x: xsf, y: ysf,
        line: { width: 1.1, color: "#888888" },
        name: "Slope field"
    });

    for (let i = 0; i < seeds.length; i++) {
        const s = seeds[i];
        py.globals.set("x0", s.x0);
        py.globals.set("y0", s.y0);

        const resF = py.runPython(`rk4_path(A, x0, y0, 4.0)`).toJs();
        const resB = py.runPython(`rk4_path(A, x0, y0, -4.0)`).toJs();

        const [xf, yf] = resF;
        const [xb, yb] = resB;

        const xx = xb.slice().reverse().concat(xf.slice(1));
        const yy = yb.slice().reverse().concat(yf.slice(1));

        traces.push({
            type: "scatter",
            mode: "lines",
            x: xx, y: yy,
            line: { width: 2.5, color: baseColors[i % baseColors.length] },
            name: `Solution ${i + 1}`
        });
    }

    return traces;
}

async function redraw() {
    try {
        clearErr();

        const a = Number(document.getElementById("a").value);
        const m = Number(document.getElementById("m").value);

        document.getElementById("aVal").textContent = fmt(a);
        document.getElementById("mVal").textContent = fmt(m);

        const traces = await computeFigureData(a, m);

        const layout = {
            template: "plotly_dark",
            margin: { l: 50, r: 10, t: 10, b: 45 },
            xaxis: { range: [-4, 4], showgrid: true, gridcolor: "#444", zeroline: false },
            yaxis: { range: [-4, 4], showgrid: true, gridcolor: "#444", zeroline: false },
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

    ["m", "a"].forEach(id => {
        const el = document.getElementById(id);

        // initialize visual state of slider UI
        updateDashSliderUI(el);

        // on drag: update slider UI + redraw plot
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