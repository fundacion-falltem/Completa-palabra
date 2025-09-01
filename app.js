'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = 'v1.0.0';
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // ===== Contenido (simple, interno) =====
  // Estructura: cada ítem define "hueco" (con _ para letras faltantes),
  // "opciones" (A–D) y "ok" índice correcto (0..3). "pista" opcional.
  const BANK = {
    facil: [
      { hueco: 'C__A', opciones: ['CAJA', 'CASA', 'CENA', 'CIMA'], ok: 1, pista:'Hogar' },
      { hueco: 'P_A',  opciones: ['PIE', 'PALO', 'PEA', 'PAN'], ok: 3, pista:'Se come' },
      { hueco: 'S__A', opciones: ['SOPA','SEÑA','SALA','SOGA'], ok: 0, pista:'Comida' },
      { hueco: 'M_NO', opciones: ['MANO','MONO','MINO','MENO'], ok: 0 },
      { hueco: 'R_TA', opciones: ['RUTA','RATA','ROTA','RETA'], ok: 1, pista:'Animal' },
      { hueco: 'L_BO', opciones: ['LADO','LAGO','LOBO','LEGO'], ok: 2, pista:'Animal' },
    ],
    media: [
      { hueco: 'CA__TA', opciones: ['CARTA','CANCHA','CASITA','CABINA'], ok:0, pista:'Se envía' },
      { hueco: 'PA__ELA', opciones: ['PASTELA','PANELA','PAELLA','PALETA'], ok:2, pista:'Comida' },
      { hueco: 'F_O__O', opciones: ['FLORNO','FOSFORO','FONDO','FOSFATO'], ok:1, pista:'Enciende' },
      { hueco: 'A__ENA', opciones: ['ARENA','ANTENA','AZUCENA','ARETES'], ok:0, pista:'Playa' },
      { hueco: 'LI__RO', opciones: ['LITRO','LIBARO','LIBERO','LIBRO'], ok:3, pista:'Se lee' },
      { hueco: 'CA__ERO', opciones: ['CARRERO','CANTERO','CAMARERO','CAJERO'], ok:3, pista:'Oficio' },
    ],
    avanzada: [
      { hueco: '__TERIOR', opciones: ['ANTERIOR','ENTERIOR','INTERIOR','OTERIOR'], ok:2 },
      { hueco: 'ME__RIA', opciones: ['MERARIA','MEMORIA','MEJERIA','METERIA'], ok:1 },
      { hueco: '_EM______IÓN', opciones: ['DEMANIPIÓN','DEMERITIÓN','DEFINICIÓN','DEMOLICIÓN'], ok:2 },
      { hueco: 'CO__NICACIÓN', opciones: ['COMUNICACIÓN','CONUNICACIÓN','COFUNICACIÓN','COTUNICACIÓN'], ok:0 },
      { hueco: 'RE__RCIMIENTO', opciones: ['RECURCIMIENTO','REINFORCIMIENTO','RECRECIMIENTO','REAPRENDIMIENTO'], ok:1, pista:'sinónimo de fortalecimiento' },
      { hueco: 'SI__ÓN', opciones: ['SIALÓN','SITUACIÓN','SIMIÓN','SIRCIÓN'], ok:1 },
    ]
  };

  // ===== Estado
  let nivel = 'facil';
  let rondasTotales = 8;
  let ronda = 0, aciertos = 0;
  let itemActual = null;

  // ===== Refs
  const difSel = document.getElementById('dificultad');
  const ronSel = document.getElementById('rondas');

  const btnComenzar = document.getElementById('btnComenzar');
  const btnReiniciar= document.getElementById('btnReiniciar');

  const enunciado   = document.getElementById('enunciado');
  const huecoEl     = document.getElementById('hueco');
  const opcionesEl  = document.getElementById('opciones');
  const pistaEl     = document.getElementById('pista');
  const feedbackEl  = document.getElementById('feedback');

  const pbFill   = document.getElementById('pbFill');
  const progTxt  = document.getElementById('progTxt');
  const aciTxt   = document.getElementById('aciertos');

  // Tema / modal
  const themeBtn   = document.getElementById('themeToggle');
  const aboutBtn   = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');

  // ===== Utils
  const setTxt = (el, t)=>{ if(el) el.textContent = String(t); };
  const pick = (arr)=> arr[Math.floor(Math.random()*arr.length)];
  const barajar = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };

  function actualizarUI(){
    setTxt(progTxt, `${Math.min(ronda, rondasTotales)}/${rondasTotales}`);
    setTxt(aciTxt, aciertos);
    const pct = Math.round((Math.min(ronda, rondasTotales)/rondasTotales)*100);
    pbFill.style.width = pct + '%';
  }

  function nuevaRonda(){
    if (ronda >= rondasTotales){ finJuego(); return; }

    const pool = BANK[nivel];
    // seleccionar un item y construir opciones posicionando correcta A–D aleatoriamente
    const base = pick(pool);
    const opciones = base.opciones.slice(); // 4
    const correcta = opciones[base.ok];

    // barajar manteniendo mapeo de correcta
    const indices = [0,1,2,3];
    barajar(indices);
    const opcionesOrdenadas = indices.map(i => opciones[i]);
    const idxCorrecta = indices.indexOf(base.ok);

    // Render
    setTxt(enunciado, 'Completá la palabra:');
    setTxt(huecoEl, base.hueco);
    if (base.pista){ pistaEl.hidden = false; setTxt(pistaEl, `Pista: ${base.pista}`); }
    else { pistaEl.hidden = true; setTxt(pistaEl, ''); }

    renderOpciones(opcionesOrdenadas, idxCorrecta);

    itemActual = { correcta, idxCorrecta };
    setTxt(feedbackEl, '');
    feedbackEl.className = 'feedback muted';

    actualizarUI();
  }

  function renderOpciones(lista, idxCorrecta){
    opcionesEl.innerHTML = '';
    const letras = ['A','B','C','D'];

    lista.forEach((texto, i)=>{
      const b = document.createElement('button');
      b.className = 'opcion-btn';
      b.setAttribute('data-idx', String(i));
      b.setAttribute('aria-label', `Opción ${letras[i]}: ${texto}`);
      b.innerHTML = `<strong>${letras[i]}.</strong> ${texto}`;
      b.addEventListener('click', ()=> elegir(i, idxCorrecta, b));
      opcionesEl.appendChild(b);
    });

    // Atajos A–D
    const onKey = (e)=>{
      const k = e.key.toUpperCase();
      const pos = letras.indexOf(k);
      if (pos >= 0) opcionesEl.children[pos]?.click();
    };
    document.addEventListener('keydown', onKey, {once:true});
  }

  function bloquearOpciones(){
    opcionesEl.querySelectorAll('button').forEach(b=> b.disabled = true);
  }

  function elegir(idxElegida, idxCorrecta, btn){
    bloquearOpciones();
    const ok = (idxElegida === idxCorrecta);
    btn.classList.add(ok ? 'ok' : 'bad');

    if (!ok){
      const correctoBtn = opcionesEl.children[idxCorrecta];
      correctoBtn.classList.add('ok');
    }

    if (ok){
      aciertos++;
      setTxt(feedbackEl, '✔ ¡Correcto!');
      feedbackEl.className = 'feedback ok';
    } else {
      setTxt(feedbackEl, `✘ Casi. Respuesta correcta: ${itemActual.correcta}.`);
      feedbackEl.className = 'feedback bad';
    }

    ronda++;
    if (ronda >= rondasTotales){
      setTimeout(finJuego, 650);
    } else {
      setTimeout(nuevaRonda, 650);
    }
  }

  function finJuego(){
    opcionesEl.innerHTML = '';
    setTxt(huecoEl, '');
    setTxt(enunciado, '🎉 ¡Buen trabajo!');
    setTxt(feedbackEl, `Resultado final: ${aciertos} de ${rondasTotales}.`);
    feedbackEl.className = 'feedback ok';
    btnReiniciar.hidden = false;
    btnComenzar.hidden = true;
    actualizarUI();
  }

  // ===== Eventos
  btnComenzar.addEventListener('click', ()=>{
    nivel = difSel.value;
    rondasTotales = Number(ronSel.value);

    try{
      localStorage.setItem('comp_dif', nivel);
      localStorage.setItem('comp_rondas', String(rondasTotales));
    }catch{}

    ronda = 0; aciertos = 0;
    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    nuevaRonda();
  });

  btnReiniciar.addEventListener('click', ()=>{
    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;
    setTxt(enunciado, 'Presioná “Comenzar” para iniciar.');
    setTxt(huecoEl, '');
    setTxt(pistaEl, ''); pistaEl.hidden = true;
    setTxt(feedbackEl, ''); feedbackEl.className = 'feedback muted';
    opcionesEl.innerHTML = '';
    ronda = 0; aciertos = 0;
    actualizarUI();
  });

  // Restaurar prefs
  try{
    const d = localStorage.getItem('comp_dif');
    if (d && ['facil','media','avanzada'].includes(d)) difSel.value = d;

    const r = localStorage.getItem('comp_rondas');
    if (r && ['6','8','10'].includes(r)) ronSel.value = r;
  }catch{}

  // ===== Tema
  function applyTheme(mode){
    const m=(mode==='light'||mode==='dark')?mode:'dark';
    document.documentElement.setAttribute('data-theme', m);
    if (themeBtn){
      const isDark=(m==='dark');
      themeBtn.textContent = isDark ? 'Cambiar tema' : 'Cambiar tema';
      themeBtn.setAttribute('aria-pressed', String(isDark));
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', m==='dark' ? '#0b0b0b' : '#ffffff');
  }
  (function initTheme(){
    let mode='dark';
    try{
      const stored=localStorage.getItem('theme');
      if(stored==='light'||stored==='dark') mode=stored;
      else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) mode='light';
    }catch{}
    applyTheme(mode);
  })();
  themeBtn.addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('theme', next); } catch {}
    applyTheme(next);
  });

  // ===== Modal ayuda
  function openAbout(){ aboutModal?.setAttribute('aria-hidden','false'); aboutClose?.focus(); }
  function closeAbout(){ aboutModal?.setAttribute('aria-hidden','true'); }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });

  // Init
  actualizarUI();
});
