let py = null;

function fmt(x, d=2){ return Number(x).toFixed(d); }

function showErr(e){
  const box=document.getElementById("errBox");
  if(!box) return;
  box.style.display="block";
  box.textContent=(e && e.stack) ? e.stack : String(e);
}
function clearErr(){
  const box=document.getElementById("errBox");
  if(!box) return;
  box.style.display="none";
  box.textContent="";
}

function updateDashSliderUI(input){
  const min=Number(input.min), max=Number(input.max), val=Number(input.value);
  const pct=((val-min)/(max-min))*100;
  const wrap=input.closest(".slider-wrap");
  if(!wrap) return;
  wrap.style.setProperty("--fill", String(pct));
  const ticks=wrap.querySelectorAll(".dash-tick");
  ticks.forEach(t=>{
    const pStr=t.style.getPropertyValue("--p").trim();
    const p=Number(pStr.replace("%",""));
    t.classList.toggle("active", p <= pct + 1e-9);
  });
}

function setupLanguageToggle(){
  const langBtn=document.getElementById("langToggle");
  const es=document.getElementById("text-es");
  const en=document.getElementById("text-en");
  if(!langBtn||!es||!en) return;
  let cur="es";
  langBtn.addEventListener("click", ()=>{
    if(cur==="es"){ es.style.display="none"; en.style.display="block"; langBtn.textContent="Español"; cur="en"; }
    else { en.style.display="none"; es.style.display="block"; langBtn.textContent="English"; cur="es"; }
    if(window.MathJax) MathJax.typesetPromise();
  });
}

async function initPy(){
  py = await initPyodideBase({ packages:["numpy"], stderr:(s)=>console.log("[pyodide]", s) });
  try{
    await loadPythonFile(py, "./bifurcation.py");
    console.log("[bif] loaded ./bifurcation.py");
  }catch(e1){
    console.warn("[bif] failed ./bifurcation.py; trying assets...", e1);
    await loadPythonFile(py, "../../../assets/mathlets/bifurcation.py");
    console.log("[bif] loaded assets/bifurcation.py");
  }
}

function readUI(){
  return {
    model: document.getElementById("model").value,
    r: Number(document.getElementById("r").value),
    T: Number(document.getElementById("T").value),
    x0: Number(document.getElementById("x0").value),
  };
}

let solutions=[]; // list of {t:[], x:[], x0:number}

async function computeAll(x0Override=null){
  const ui=readUI();
  const x0 = (x0Override===null) ? ui.x0 : x0Override;

  py.globals.set("model", ui.model);
  py.globals.set("r", ui.r);
  py.globals.set("x0", x0);
  py.globals.set("T", ui.T);
  py.globals.set("dt", 0.01);

  const out = py.runPython(`compute_all(model, r, x0, T, dt)`);
  return out.toJs();
}

function bifLayout(){
  return {
    template:"plotly_dark",
    margin:{l:55,r:10,t:10,b:55},
    xaxis:{title:"r", range:[-2,2], showgrid:true, gridcolor:"#444", zeroline:false},
    yaxis:{title:"equilibria x*", range:[-2.6,2.6], showgrid:true, gridcolor:"#444", zeroline:false},
    paper_bgcolor:"#1e1e1e",
    plot_bgcolor:"#1e1e1e",
    font:{color:"#f0f0f0"},
    showlegend:false,
  };
}

function timeLayout(){
  return {
    template:"plotly_dark",
    margin:{l:55,r:10,t:10,b:55},
    xaxis:{title:"t", range:[0, Number(document.getElementById("T").value)], showgrid:true, gridcolor:"#444", zeroline:false},
    yaxis:{title:"x(t)", range:[-3,3], showgrid:true, gridcolor:"#444", zeroline:false},
    paper_bgcolor:"#1e1e1e",
    plot_bgcolor:"#1e1e1e",
    font:{color:"#f0f0f0"},
    showlegend:false,
  };
}

async function redraw(){
  try{
    clearErr();
    const ui=readUI();
    document.getElementById("rVal").textContent = fmt(ui.r,2);
    document.getElementById("TVal").textContent = fmt(ui.T,1);
    updateDashSliderUI(document.getElementById("r"));
    updateDashSliderUI(document.getElementById("T"));

    const data = await computeAll(null);

    // --- Bifurcation traces
    const bifTraces=[];

    // stable branches (green)
    for(const c of data.stable){
      bifTraces.push({
        type:"scatter", mode:"lines",
        x:c.r, y:c.x,
        line:{width:2.8, color:"rgba(50,210,90,0.95)"},
        hoverinfo:"skip",
      });
    }
    // unstable branches (gray dashed)
    for(const c of data.unstable){
      bifTraces.push({
        type:"scatter", mode:"lines",
        x:c.r, y:c.x,
        line:{width:2.3, color:"rgba(210,210,210,0.75)", dash:"dash"},
        hoverinfo:"skip",
      });
    }
    // current r marker vertical line (thin)
    bifTraces.push({
      type:"scatter", mode:"lines",
      x:[data.r, data.r], y:[-2.6, 2.6],
      line:{width:1.4, color:"rgba(255,255,255,0.35)"},
      hoverinfo:"skip",
    });

    await Plotly.react("plotBif", bifTraces, bifLayout(), {responsive:true});

    // --- Time traces
    const timeTraces=[];

    // invisible click-capture line at t=0
    timeTraces.push({
      type:"scatter", mode:"markers",
      x: data.clickline.t,
      y: data.clickline.x,
      marker:{size:18, color:"rgba(0,0,0,0)"},
      hoverinfo:"skip",
      showlegend:false,
    });

    // stored solutions
    for(const s of solutions){
      timeTraces.push({
        type:"scatter", mode:"lines",
        x:s.t, y:s.x,
        line:{width:2.6, color:"rgba(50,210,90,0.95)"},
        hoverinfo:"skip",
      });
    }

    // a faint reference trajectory for current x0 (optional; keep subtle)
    timeTraces.push({
      type:"scatter", mode:"lines",
      x:data.sol.t, y:data.sol.x,
      line:{width:1.4, color:"rgba(102,232,140,0.30)"},
      hoverinfo:"skip",
    });

    await Plotly.react("plotTime", timeTraces, timeLayout(), {responsive:true});

    // bind click: set x0 from clicked y and auto-add solution
    const timeDiv = document.getElementById("plotTime");
    timeDiv.removeAllListeners?.("plotly_click");
    timeDiv.on?.("plotly_click", async (ev)=>{
      try{
        if(!ev || !ev.points || !ev.points.length) return;
        const y = ev.points[0].y;
        if(typeof y !== "number") return;
        document.getElementById("x0").value = fmt(y, 3);
        await addSolutionFromCurrent();
      }catch(e){ showErr(e); }
    });

  }catch(e){
    showErr(e);
    console.error(e);
  }
}

async function addSolutionFromCurrent(){
  const ui=readUI();
  const data = await computeAll(ui.x0);
  solutions.push({t:data.sol.t, x:data.sol.x, x0:ui.x0});
  await redraw();
}

async function main(){
  setupLanguageToggle();
  await initPy();

  // init slider UI
  updateDashSliderUI(document.getElementById("r"));
  updateDashSliderUI(document.getElementById("T"));

  document.getElementById("r").addEventListener("input", redraw);
  document.getElementById("T").addEventListener("input", redraw);
  document.getElementById("model").addEventListener("change", ()=>{
    solutions=[];
    redraw();
  });

  document.getElementById("addBtn").addEventListener("click", async ()=>{
    await addSolutionFromCurrent();
  });
  document.getElementById("clearBtn").addEventListener("click", async ()=>{
    solutions=[];
    await redraw();
  });

  await redraw();
}

main();
