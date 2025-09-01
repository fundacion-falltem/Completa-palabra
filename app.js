'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const VERSION = 'v1.3.0 (sin repeticiones por partida + timer + JSON externo)';
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  // ===== Banco interno (fallback) =====
  const BANK_FALLBACK = {
    facil: [
      { hueco: 'C__A', opciones: ['CAJA', 'CASA', 'CENA', 'CIMA'], ok: 1, pista:'Hogar' },
      { hueco: 'P_A',  opciones: ['PIE', 'PALO', 'PEA', 'PAN'], ok: 3, pista:'Se come' },
      { hueco: 'S__A', opciones: ['SOPA','SEÑA','SALA','SOGA'], ok: 0, pista:'Comida' },
      { hueco: 'M_NO', opciones: ['MANO','MONO','MINO','MENO'], ok: 0 },
      { hueco: 'R_TA', opciones: ['RUTA','RATA','ROTA','RETA'], ok: 1, pista:'Animal' },
      { hueco: 'L_BO', opciones: ['LADO','LAGO','LOBO','LEGO'], ok: 2, pista:'Animal' }
    ],
    media: [
      { hueco: 'CA__TA', opciones: ['CARTA','CANCHA','CASITA','CABINA'], ok:0, pista:'Se envía' },
      { hueco: 'PA__ELA', opciones: ['PASTELA','PANELA','PAELLA','PALETA'], ok:2, pista:'Comida' },
      { hueco: 'F_O__O', opciones: ['FLORNO','FOSFORO','FONDO','FOSFATO'], ok:1, pista:'Enciende' },
      { hueco: 'A__ENA', opciones: ['ARENA','ANTENA','AZUCENA','ARETES'], ok:0, pista:'Playa' },
      { hueco: 'LI__RO', opciones: ['LITRO','LIBARO','LIBERO','LIBRO'], ok:3, pista:'Se lee' },
      { hueco: 'CA__ERO', opciones: ['CARRERO','CANTERO','CAMARERO','CAJERO'], ok:3, pista:'Oficio' }
    ],
    avanzada: [
      { hueco: '__TERIOR', opciones: ['ANTERIOR','ENTERIOR','INTERIOR','OTERIOR'], ok:2 },
      { hueco: 'ME__RIA', opciones: ['MERARIA','MEMORIA','MEJERIA','METERIA'], ok:1 },
      { hueco: '_EM______IÓN', opciones: ['DEMANIPIÓN','DEMERITIÓN','DEFINICIÓN','DEMOLICIÓN'], ok:2 },
      { hueco: 'CO__NICACIÓN', opciones: ['COMUNICACIÓN','CONUNICACIÓN','COFUNICACIÓN','COTUNICACIÓN'], ok:0 },
      { hueco: 'RE__RCIMIENTO', opciones: ['RECURCIMIENTO','REINFORCIMIENTO','RECRECIMIENTO','REAPRENDIMIENTO'], ok:1, pista:'fortalecimiento' },
      { hueco: 'SI__ÓN', opciones: ['SIALÓN','SITUACIÓN','SIMIÓN','SIRCIÓN'], ok:1 }
    ]
  };

  // ===== Banco activo (JSON externo con fallback) =====
  let BANK = BANK_FALLBACK;
  let catalogoListo = false;

  async function cargarBanco(url){
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('No se pudo cargar el JSON');
    const data = await res.json();
    validarBanco(data);
    return data;
  }
  function validarBanco(data){
    const niveles = ['facil','media','avanzada'];
    for (const n of niveles){
      if (!Array.isArray(data[n])) throw new Error(`Falta arreglo "${n}"`);
      for (const item of data[n]){
        if (typeof item.hueco !== 'string' || !Array.isArray(item.opciones) || item.opciones.length !== 4)
          throw new Error(`Ítem inválido en ${n}: requiere {hueco, opciones[4], ok}`);
        if (!Number.isInteger(item.ok) || item.ok < 0 || item.ok > 3)
          throw new Error(`"ok" inválido en ${n} (debe ser 0..3)`);
        if (item.pista != null && typeof item.pista !== 'string')
          throw new Error(`"pista" inválida en ${n}`);
      }
    }
  }
  async function initBanco(){
    if (catalogoListo) return;
    const params = new URLSearchParams(location.search);
    const url = params.get('bank') || './data/es-palabras.json';
    try{
      const data = await cargarBanco(url);
      BANK = data;
      console.log('📚 Banco externo activo:', url);
    }catch(e){
      console.warn('⚠️ Banco externo no disponible. Uso fallback interno:', e.message);
      BANK = BANK_FALLBACK;
    }finally{
      catalogoListo = true;
    }
  }

  // ===== Estado
  let nivel = 'facil';
  let rondasTotales = 8;
  let ronda = 0, aciertos = 0;
  let itemActual = null;

  // Pool sin reposición (para no repetir en la partida)
  let poolActual = [];

  // Timer
  let timerId = null;
  let timeLeft = 0; // ms
  let timeMax  = 0; // ms

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

  // Timer UI
  const timerText = document.getElementById('timerText');
  const timerFill = document.getElementById('timerFill');
  const timerBar  = document.querySelector('.timerBar');

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

  // ===== Timer helpers
  function tiempoPorDificultad(){
    if (nivel === 'facil') return 14000;   // 14s
    if (nivel === 'media') return 10000;   // 10s
    return 8000;                           // 8s (avanzada)
  }
  function showTimer(){
    if (timerText){ timerText.style.display = ''; timerText.setAttribute('aria-hidden','false'); }
    if (timerBar){ timerBar.style.display = ''; timerBar.setAttribute('aria-hidden','true'); }
  }
  function hideTimer(){
    if (timerText){ timerText.style.display = 'none'; timerText.setAttribute('aria-hidden','true'); }
    if (timerBar){ timerBar.style.display = 'none'; timerBar.setAttribute('aria-hidden','true'); }
  }
  function stopTimer(){
    if (timerId){ clearInterval(timerId); timerId = null; }
  }
  function startTimer(ms){
    stopTimer();
    timeMax = ms;
    timeLeft = ms;
    updateTimerUI();

    timerId = setInterval(()=>{
      timeLeft -= 100;
      if (timeLeft <= 0){
        timeLeft = 0;
        updateTimerUI();
        stopTimer();
        tiempoAgotado();
      } else {
        updateTimerUI();
      }
    }, 100);
  }
  function updateTimerUI(){
    // texto
    if (timerText){
      const s = Math.ceil(timeLeft / 1000);
      setTxt(timerText, s > 0 ? `Tiempo: ${s} s` : 'Tiempo: 0 s');
      const alerta = timeLeft <= 3000 && timeLeft > 0;
      timerText.classList.toggle('timer-alert', alerta);
      timerText.classList.toggle('timer-pulse', alerta);
      if (alerta && navigator.vibrate) navigator.vibrate(40);
    }
    // barra
    if (timerFill && timeMax > 0){
      const pct = Math.max(0, Math.min(100, Math.round((timeLeft / timeMax) * 100)));
      timerFill.style.width = pct + '%';
      const styles = getComputedStyle(document.documentElement);
      timerFill.style.backgroundColor = (timeLeft <= 3000 && timeLeft > 0)
        ? styles.getPropertyValue('--timer-warn')
        : styles.getPropertyValue('--timer-ok');
    }
  }

  // ===== Rondas
  function nuevaRonda(){
    if (ronda >= rondasTotales){ finJuego(); return; }

    // Si se vació el pool y aún faltan rondas, reinyectamos el banco del nivel
    if (poolActual.length === 0) {
      poolActual = [...BANK[nivel]];
    }

    // Tomamos un ítem aleatorio del pool y lo removemos (sin reposición)
    const idx = Math.floor(Math.random() * poolActual.length);
    const base = poolActual.splice(idx, 1)[0];

    // barajar opciones manteniendo correcta
    const indices = [0,1,2,3]; barajar(indices);
    const opcionesOrdenadas = indices.map(i => base.opciones[i]);
    const idxCorrecta = indices.indexOf(base.ok);

    // Render
    setTxt(enunciado, 'Completá la palabra:');
    setTxt(huecoEl, base.hueco);
    if (base.pista){ pistaEl.hidden = false; setTxt(pistaEl, `Pista: ${base.pista}`); }
    else { pistaEl.hidden = true; setTxt(pistaEl, ''); }

    renderOpciones(opcionesOrdenadas, idxCorrecta, base.opciones[base.ok]);

    itemActual = { correcta: base.opciones[base.ok], idxCorrecta };
    setTxt(feedbackEl, '');
    feedbackEl.className = 'feedback muted';

    actualizarUI();

    // Timer por pregunta
    showTimer();
    startTimer(tiempoPorDificultad());
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
    stopTimer();

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

  function tiempoAgotado(){
    bloquearOpciones();
    const correctoBtn = opcionesEl.children[itemActual.idxCorrecta];
    if (correctoBtn) correctoBtn.classList.add('ok');
    setTxt(feedbackEl, `⏰ Tiempo agotado. La respuesta correcta era: ${itemActual.correcta}.`);
    feedbackEl.className = 'feedback bad';

    ronda++;
    if (ronda >= rondasTotales){
      setTimeout(finJuego, 650);
    } else {
      setTimeout(nuevaRonda, 550);
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

    // limpiar timer
    hideTimer();
    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';
  }

  // ===== Eventos
  btnComenzar.addEventListener('click', async ()=>{
    await initBanco(); // asegura JSON externo
    nivel = difSel.value;
    rondasTotales = Number(ronSel.value);

    try{
      localStorage.setItem('comp_dif', nivel);
      localStorage.setItem('comp_rondas', String(rondasTotales));
    }catch{}

    // Reinicio de estado de partida
    ronda = 0; aciertos = 0;
    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    // Armar pool sin reposición para este nivel
    poolActual = [...BANK[nivel]];

    // reset timer UI
    showTimer();
    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';

    nuevaRonda();
  });

  btnReiniciar.addEventListener('click', ()=>{
    stopTimer();
    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;

    setTxt(enunciado, 'Presioná “Comenzar” para iniciar.');
    setTxt(huecoEl, '');
    setTxt(pistaEl, ''); pistaEl.hidden = true;
    setTxt(feedbackEl, ''); feedbackEl.className = 'feedback muted';
    opcionesEl.innerHTML = '';
    ronda = 0; aciertos = 0;

    // vaciar poolActual (se regenerará al comenzar)
    poolActual = [];

    actualizarUI();
    hideTimer();
    setTxt(timerText, '');
    if (timerFill) timerFill.style.width = '0%';
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
  hideTimer(); // oculto timer hasta que arranque
});
