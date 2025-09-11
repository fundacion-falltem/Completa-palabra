'use strict';

document.addEventListener('DOMContentLoaded', () => {
  /* ===== Versión ===== */
  const VERSION = 'Completa-palabra v1.4.2 (UI conectada a HTML actual)';
  const versionEl = document.getElementById('versionLabel');
  if (versionEl) versionEl.textContent = VERSION;

  /* ===== Banco interno (fallback) ===== */
  const BANK_FALLBACK = {
    facil: [
      { hueco: 'C__A', opciones: ['CAJA','CASA','CENA','CIMA'], ok: 1, pista:'Hogar' },
      { hueco: 'P_A',  opciones: ['PIE','PALO','PEA','PAN'],   ok: 3, pista:'Se come' },
      { hueco: 'S__A', opciones: ['SOPA','SEÑA','SALA','SOGA'], ok: 0, pista:'Comida' },
      { hueco: 'M_NO', opciones: ['MANO','MONO','MINO','MENO'], ok: 0 },
      { hueco: 'R_TA', opciones: ['RUTA','RATA','ROTA','RETA'], ok: 1, pista:'Animal' },
      { hueco: 'L_BO', opciones: ['LADO','LAGO','LOBO','LEGO'], ok: 2, pista:'Animal' }
    ],
    media: [
      { hueco: 'CA__TA',    opciones: ['CARTA','CANCHA','CASITA','CABINA'], ok:0, pista:'Se envía' },
      { hueco: 'PA__ELA',   opciones: ['PASTELA','PANELA','PAELLA','PALETA'], ok:2, pista:'Comida' },
      { hueco: 'F_O__O',    opciones: ['FLORNO','FOSFORO','FONDO','FOSFATO'], ok:1, pista:'Enciende' },
      { hueco: 'A__ENA',    opciones: ['ARENA','ANTENA','AZUCENA','ARETES'],  ok:0, pista:'Playa' },
      { hueco: 'LI__RO',    opciones: ['LITRO','LIBARO','LIBERO','LIBRO'],    ok:3, pista:'Se lee' },
      { hueco: 'CA__ERO',   opciones: ['CARRERO','CANTERO','CAMARERO','CAJERO'], ok:3, pista:'Oficio' }
    ],
    avanzada: [
      { hueco: '__TERIOR',        opciones: ['ANTERIOR','ENTERIOR','INTERIOR','OTERIOR'], ok:2 },
      { hueco: 'ME__RIA',         opciones: ['MERARIA','MEMORIA','MEJERIA','METERIA'],    ok:1 },
      { hueco: '_EM______IÓN',    opciones: ['DEMANIPIÓN','DEMERITIÓN','DEFINICIÓN','DEMOLICIÓN'], ok:2 },
      { hueco: 'CO__NICACIÓN',    opciones: ['COMUNICACIÓN','CONUNICACIÓN','COFUNICACIÓN','COTUNICACIÓN'], ok:0 },
      { hueco: 'RE__RCIMIENTO',   opciones: ['RECURCIMIENTO','REINFORCIMIENTO','RECRECIMIENTO','REAPRENDIMIENTO'], ok:1, pista:'Fortalecimiento' },
      { hueco: 'SI__ÓN',          opciones: ['SIALÓN','SITUACIÓN','SIMIÓN','SIRCIÓN'],    ok:1 }
    ]
  };

  /* ===== Banco activo (JSON externo con fallback) ===== */
  let BANK = BANK_FALLBACK;
  let bancoListo = false;

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
    if (bancoListo) return;
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
      bancoListo = true;
    }
  }

  /* ===== Estado y referencias ===== */
  let nivel = 'media';                  // default
  let rondasTotales = 8;                // no hay select de rondas en tu HTML
  let ronda = 0, aciertos = 0;
  let itemActual = null;
  let poolActual = [];

  // Guard para atajos de teclado
  let rondaActiva = false;
  let keyGuardUntil = 0;

  // Refs del DOM (solo los que EXISTEN en tu HTML)
  const difSel      = document.getElementById('dificultad');
  const tamSel      = document.getElementById('tamano');
  const btnComenzar = document.getElementById('btnComenzar');
  const btnReiniciar= document.getElementById('btnReiniciar');
  const juegoEl     = document.getElementById('juego');
  const hudText     = document.getElementById('hudText');

  // FABs y modal
  const themeBtn   = document.getElementById('themeToggle');
  const aboutBtn   = document.getElementById('aboutBtn');
  const aboutModal = document.getElementById('aboutModal');
  const aboutClose = document.getElementById('aboutClose');

  /* ===== Utils ===== */
  const setTxt = (el, t) => { if (el) el.textContent = String(t); };
  const barajar = (arr)=>{ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]];} return arr; };
  const mapNivel = (v)=> (v==='dificil' ? 'avanzada' : (v||'media'));

  function aplicarTam(){
    const muy = tamSel && tamSel.value === 'muy-grande';
    document.documentElement.classList.toggle('muy-grande', !!muy);
    try{ localStorage.setItem('comp_tamano', muy ? 'muy-grande' : 'grande'); }catch{}
  }

  function actualizarHUD(){
    setTxt(hudText, `Progreso: ${Math.min(ronda, rondasTotales)}/${rondasTotales} · Aciertos: ${aciertos}`);
  }

  /* ===== Render de tarjeta de pregunta dentro de #juego ===== */
  function plantillaTarjeta(){
    const tarjeta = document.createElement('div');
    tarjeta.className = 'tarjeta';

    const enu = document.createElement('p');
    enu.className = 'pregunta';
    enu.id = 'enunciado';
    enu.textContent = 'Completá la palabra:';
    tarjeta.appendChild(enu);

    const hueco = document.createElement('p');
    hueco.id = 'hueco';
    hueco.className = 'hueco';
    tarjeta.appendChild(hueco);

    const pista = document.createElement('p');
    pista.id = 'pista';
    pista.className = 'pista';
    pista.hidden = true;
    tarjeta.appendChild(pista);

    const opciones = document.createElement('div');
    opciones.className = 'opciones';
    opciones.id = 'opciones';
    tarjeta.appendChild(opciones);

    const fb = document.createElement('p');
    fb.id = 'feedback';
    fb.className = 'feedback muted';
    fb.setAttribute('role','status');
    fb.setAttribute('aria-live','polite');
    fb.setAttribute('aria-atomic','true');
    tarjeta.appendChild(fb);

    return { tarjeta, enu, hueco, pista, opciones, fb };
  }

  /* ===== Lógica de juego ===== */
  function nuevaRonda(){
    if (ronda >= rondasTotales){ finJuego(); return; }

    if (poolActual.length === 0) {
      poolActual = [...BANK[nivel]];
    }

    const idx = Math.floor(Math.random() * poolActual.length);
    const base = poolActual.splice(idx, 1)[0];

    // Reordenar opciones y calcular índice correcto
    const order = [0,1,2,3]; barajar(order);
    const opcionesOrdenadas = order.map(i => base.opciones[i]);
    const idxCorrecta = order.indexOf(base.ok);
    const palabraCorrecta = base.opciones[base.ok];

    // Construir/limpiar contenedor
    juegoEl.innerHTML = '';
    const { tarjeta, hueco, pista, opciones, fb } = plantillaTarjeta();
    juegoEl.appendChild(tarjeta);

    // Pista
    let pistaTexto = base.pista;
    if (!pistaTexto && typeof palabraCorrecta === 'string' && palabraCorrecta.length > 0) {
      pistaTexto = `Empieza con “${palabraCorrecta[0]}” y tiene ${palabraCorrecta.length} letras.`;
    }
    if (pistaTexto){
      pista.hidden = false;
      pista.textContent = `Pista: ${pistaTexto}`;
    } else {
      pista.hidden = true;
      pista.textContent = '';
    }

    // Hueco
    setTxt(hueco, base.hueco);

    // Opciones
    renderOpciones(opcionesOrdenadas, idxCorrecta, opciones, fb, palabraCorrecta);

    // Estado actual
    itemActual = { correcta: palabraCorrecta, idxCorrecta };
    setTxt(fb, '');
    fb.className = 'feedback muted';

    // HUD y foco
    actualizarHUD();
    rondaActiva = true;
    keyGuardUntil = performance.now() + 150;

    // Foco primer botón y scroll
    requestAnimationFrame(()=>{
      opciones.querySelector('button')?.focus({ preventScroll:true });
      tarjeta.scrollIntoView({ behavior:'smooth', block:'start' });
    });

    // Atajos A–D
    const onKey = (e)=>{
      if (!rondaActiva || performance.now() < keyGuardUntil) return;
      const k = e.key?.toUpperCase();
      const pos = ['A','B','C','D'].indexOf(k);
      if (pos >= 0) opciones.children[pos]?.click();
    };
    document.addEventListener('keyup', onKey, { once:true });
  }

  function renderOpciones(lista, idxCorrecta, cont, fb, palabraCorrecta){
    cont.innerHTML = '';
    const letras = ['A','B','C','D'];

    lista.forEach((texto, i)=>{
      const b = document.createElement('button');
      b.className = 'opcion-btn';
      b.setAttribute('data-idx', String(i));
      b.setAttribute('aria-label', `Opción ${letras[i]}: ${texto}`);
      b.innerHTML = `<strong>${letras[i]}.</strong> ${texto}`;
      b.addEventListener('click', ()=> elegir(i, idxCorrecta, b, cont, fb, palabraCorrecta));
      cont.appendChild(b);
    });
  }

  function bloquearOpciones(cont){
    cont.querySelectorAll('button').forEach(b=> b.disabled = true);
  }

  function elegir(idxElegida, idxCorrecta, btn, cont, fb, palabraCorrecta){
    rondaActiva = false;
    bloquearOpciones(cont);

    const ok = (idxElegida === idxCorrecta);
    btn.classList.add(ok ? 'ok' : 'bad');

    if (!ok){
      const correctoBtn = cont.children[idxCorrecta];
      correctoBtn.classList.add('ok');
    }

    if (ok){
      aciertos++;
      setTxt(fb, '✔ ¡Correcto!');
      fb.className = 'feedback ok';
    } else {
      setTxt(fb, `✘ Casi. Respuesta correcta: ${palabraCorrecta}.`);
      fb.className = 'feedback bad';
    }

    ronda++;
    actualizarHUD();

    if (ronda >= rondasTotales){
      setTimeout(finJuego, 650);
    } else {
      setTimeout(nuevaRonda, 650);
    }
  }

  function finJuego(){
  // Limpia el contenedor del juego
  juegoEl.innerHTML = '';

  // ---- Tarjeta de cierre ----
  const tarjeta = document.createElement('div');
  tarjeta.className = 'tarjeta';

  // Mensaje según desempeño
  const ratio = aciertos / rondasTotales;
  let titulo, msj;
  if (ratio >= 0.85){
    titulo = '🎉 ¡Excelente!';
    msj = `Lograste ${aciertos} de ${rondasTotales}. Podés subir la dificultad cuando quieras.`;
  } else if (ratio >= 0.6){
    titulo = '👏 ¡Bien hecho!';
    msj = `Resultado: ${aciertos} de ${rondasTotales}. Seguí practicando y probá subir la dificultad cuando te sientas cómodo.`;
  } else if (ratio >= 0.35){
    titulo = '💪 ¡Buen intento!';
    msj = `${aciertos} de ${rondasTotales}. Arrancá con “Fácil” y andá subiendo a tu ritmo.`;
  } else {
    titulo = '🌱 ¡Muy bien por practicar!';
    msj = `${aciertos} de ${rondasTotales}. Probá sesiones cortas y constantes, sin apuro.`;
  }

  const h = document.createElement('p');
  h.className = 'pregunta';
  h.textContent = titulo;

  const p = document.createElement('p');
  p.textContent = msj;

  const acciones = document.createElement('div');
  acciones.className = 'acciones';

  // CTA principal (en la tarjeta)
  const rejugar = document.createElement('button');
  rejugar.className = 'btn principal';
  rejugar.textContent = 'Volver a jugar';
  rejugar.addEventListener('click', ()=>{
    ronda = 0; aciertos = 0; poolActual = [...BANK[nivel]];
    actualizarHUD();
    nuevaRonda();
  });

  // CTA secundario (link)
  const aOtros = document.createElement('a');
  aOtros.href = 'https://falltem.org/juegos/#games-cards';
  aOtros.className = 'btn secundario';
  aOtros.textContent = 'Elegir otro juego';
  aOtros.target = '_blank';
  aOtros.rel = 'noopener noreferrer';

  acciones.appendChild(rejugar);
  acciones.appendChild(aOtros);

  tarjeta.appendChild(h);
  tarjeta.appendChild(p);
  tarjeta.appendChild(acciones);
  juegoEl.appendChild(tarjeta);

  // IMPORTANTE: ocultar los botones de cabecera para que no dupliquen el CTA
  if (btnComenzar)  btnComenzar.hidden  = true;
  if (btnReiniciar) btnReiniciar.hidden = true;
}


  /* ===== Eventos principales ===== */
  btnComenzar?.addEventListener('click', async ()=>{
    await initBanco();

    nivel = mapNivel(difSel?.value);
    try{ localStorage.setItem('comp_dif', nivel); }catch{}

    ronda = 0; aciertos = 0;
    poolActual = [...BANK[nivel]];

    btnComenzar.hidden = true;
    btnReiniciar.hidden = true;

    nuevaRonda();
  });

  btnReiniciar?.addEventListener('click', ()=>{
    // volver al estado inicial (muestra botón Comenzar)
    juegoEl.innerHTML = '';
    ronda = 0; aciertos = 0;
    actualizarHUD();
    btnComenzar.hidden = false;
    btnReiniciar.hidden = true;
  });

  difSel?.addEventListener('change', ()=>{
    nivel = mapNivel(difSel.value);
    try{ localStorage.setItem('comp_dif', nivel); }catch{}
  });

  tamSel?.addEventListener('change', aplicarTam);

  // Restaurar preferencias
  try{
    const d = localStorage.getItem('comp_dif');
    if (d && ['facil','media','avanzada'].includes(d)) nivel = d;
    if (difSel){
      difSel.value = (d === 'avanzada') ? 'dificil' : (d || 'media');
    }

    const t = localStorage.getItem('comp_tamano');
    if (t === 'muy-grande' && tamSel) tamSel.value = 'muy-grande';
    aplicarTam();
  }catch{}

  actualizarHUD();

  /* ===== Tema (LIGHT por defecto con persistencia) ===== */
  function applyTheme(mode){
    const m = (mode === 'dark') ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', m);
    if (themeBtn){
      const icon = (m === 'dark') ? '🌞' : '🌙';
      themeBtn.textContent = icon;
      themeBtn.setAttribute('aria-pressed', String(m === 'dark'));
      themeBtn.setAttribute('aria-label', m==='dark' ? 'Usar modo claro' : 'Usar modo oscuro');
    }
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) metaTheme.setAttribute('content', m==='dark' ? '#0b0b0b' : '#f8fbf4');
  }
  (function initTheme(){
    let mode = 'light';
    try{
      const stored = localStorage.getItem('theme');
      if (stored === 'light' || stored === 'dark') mode = stored;
    }catch{}
    applyTheme(mode);
  })();
  themeBtn?.addEventListener('click', ()=>{
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    try{ localStorage.setItem('theme', next); }catch{}
    applyTheme(next);
  });

  /* ===== Modal ayuda ===== */
  function openAbout(){
    if (!aboutModal) return;
    aboutModal.setAttribute('aria-hidden','false');
    document.body.classList.add('modal-open');
    aboutClose?.focus();
  }
  function closeAbout(){
    if (!aboutModal) return;
    aboutModal.setAttribute('aria-hidden','true');
    document.body.classList.remove('modal-open');
  }
  aboutBtn?.addEventListener('click', openAbout);
  aboutClose?.addEventListener('click', closeAbout);
  aboutModal?.addEventListener('click', (e)=>{ if(e.target===aboutModal) closeAbout(); });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeAbout(); });
});
