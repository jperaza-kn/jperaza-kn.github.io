let py = null;
let SIM = null;

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
  const btn=document.getElementById("langToggle");
  const es=document.getElementById("text-es");
  const en=document.getElementById("text-en");
  if(!btn||!es||!en) return;
  let cur="es";
  btn.addEventListener("click", ()=>{
    if(cur==='es'){ es.style.display='none'; en.style.display='block'; btn.textContent='Español'; cur='en'; }
    else { en.style.display='none'; es.style.display='block'; btn.textContent='English'; cur='es'; }
    if(window.MathJax) MathJax.typesetPromise();
  });
}

async function initPy(){
  py = await initPyodideBase({ packages:['numpy'], stderr:(s)=>console.log('[pyodide]', s) });
  try{
    await loadPythonFile(py, './burgers.py');
    console.log('[burgers] loaded ./burgers.py');
  }catch(e1){
    console.warn('[burgers] failed ./burgers.py; trying assets...', e1);
    await loadPythonFile(py, '../../../assets/mathlets/burgers.py');
    console.log('[burgers] loaded assets/burgers.py');
  }
}

function layoutU(xmin, xmax){
  return {
    template:'plotly_dark',
    margin:{l:55,r:10,t:10,b:55},
    xaxis:{title:'x', range:[xmin,xmax], showgrid:true, gridcolor:'#444', zeroline:false},
    yaxis:{title:'u(x,t)', range:[-1.3,1.3], showgrid:true, gridcolor:'#444', zeroline:false},
    paper_bgcolor:'#1e1e1e',
    plot_bgcolor:'#1e1e1e',
    font:{color:'#f0f0f0'},
    showlegend:false,
  };
}

function layoutXT(xmin, xmax, tmax){
  return {
    template:'plotly_dark',
    margin:{l:55,r:10,t:10,b:55},
    xaxis:{title:'x', range:[xmin,xmax], showgrid:true, gridcolor:'#444', zeroline:false},
    yaxis:{title:'t', range:[0,tmax], showgrid:true, gridcolor:'#444', zeroline:false},
    paper_bgcolor:'#1e1e1e',
    plot_bgcolor:'#1e1e1e',
    font:{color:'#f0f0f0'},
    showlegend:false,
  };
}

async function computeSim(){
  const kind=document.getElementById('ic').value;
  py.globals.set('kind', kind);
  const out = py.runPython('simulate(kind)');
  SIM = out.toJs();
}

async function drawAtTime(){
  try{
    clearErr();
    const t = Number(document.getElementById('t').value);
    document.getElementById('tVal').textContent = fmt(t, 2);
    updateDashSliderUI(document.getElementById('t'));

    if(!SIM) return;

    py.globals.set('sim', SIM);
    py.globals.set('tq', t);
    const out = py.runPython('sample_at_time(sim, tq)');
    const arr = out.toJs();
    const x = arr[0], u = arr[1];

    const tracesU = [{
      type:'scatter', mode:'lines',
      x:x, y:u,
      line:{width:2.8, color:'rgba(50,210,90,0.95)'},
      hoverinfo:'skip',
    }];
    await Plotly.react('plotU', tracesU, layoutU(SIM.xmin, SIM.xmax), {responsive:true});

    const tracesXT = [];
    const tchars = SIM.Tchars;
    for(const xx of SIM.Xchars){
      tracesXT.push({
        type:'scatter', mode:'lines',
        x:xx, y:tchars,
        line:{width:1.1, color:'rgba(102,232,140,0.28)'},
        hoverinfo:'skip',
      });
    }
    tracesXT.push({
      type:'scatter', mode:'lines',
      x:[SIM.xmin, SIM.xmax],
      y:[t, t],
      line:{width:2.0, color:'rgba(255,255,255,0.35)'},
      hoverinfo:'skip',
    });
    await Plotly.react('plotXT', tracesXT, layoutXT(SIM.xmin, SIM.xmax, 1.5), {responsive:true});

  }catch(e){
    showErr(e);
    console.error(e);
  }
}

async function recomputeAndRedraw(){
  await computeSim();
  document.getElementById('t').value = '0';
  await drawAtTime();
}

async function main(){
  setupLanguageToggle();
  await initPy();

  updateDashSliderUI(document.getElementById('t'));

  document.getElementById('t').addEventListener('input', drawAtTime);
  document.getElementById('recomputeBtn').addEventListener('click', recomputeAndRedraw);
  document.getElementById('ic').addEventListener('change', recomputeAndRedraw);

  await recomputeAndRedraw();
}

main();
