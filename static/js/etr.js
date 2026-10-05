/* Animaciones de la página de inicio.
   Cada parte arranca por separado y tiene un «plan B»: si falla al arrancar o más tarde (en el scroll,
   un temporizador, la carga de una foto), las demás siguen funcionando y lo que esa parte animaba
   queda visible (ver también el script del <head> en templates/eventos/inicio.html). */
(() => {
  'use strict';
  const html = document.documentElement;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (p, e0, e1) => { const t = clamp((p - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  const reduceMQ = matchMedia('(prefers-reduced-motion: reduce)');

  const avisar = (nombre, err) => console.error(`ETR: «${nombre}» falló; esa parte se queda sin animación.`, err);

  // Para el arranque de cada parte
  function iniciar(nombre, arranque, planB){
    try {
      return arranque() || {};
    } catch (err){
      avisar(nombre, err);
      if (planB) planB();
      return {};
    }
  }

  // Para todo lo que el navegador llama después del arranque: eventos, observadores, temporizadores, cargas
  const protegido = (nombre, fn, planB) => function (...args) {
    try {
      return fn.apply(this, args);
    } catch (err){
      avisar(nombre, err);
      if (planB) planB();
      return undefined;
    }
  };

  /* ---------- Scroll: la página se mide una sola vez por cuadro ----------
     Cada tarea mide lo que necesita y devuelve una función que escribe. Primero se mide todo
     y después se escribe todo, así el navegador no recalcula la página a cada rato. */
  const tareasScroll = [];
  let scrollRaf = null;
  function alScroll(nombre, medir, planB){
    tareasScroll.push(protegido(nombre, () => {
      const escribir = medir();
      return escribir ? protegido(nombre, escribir, planB) : null;
    }, planB));
  }
  function cuadroDeScroll(){
    scrollRaf = null;
    const escrituras = tareasScroll.map(medir => medir());
    escrituras.forEach(escribir => { if (escribir) escribir(); });
  }
  addEventListener('scroll', () => { if (scrollRaf === null) scrollRaf = requestAnimationFrame(cuadroDeScroll); }, { passive: true });

  // Con la pestaña oculta se pausan las animaciones de CSS
  document.addEventListener('visibilitychange', () => document.body.classList.toggle('paused', document.hidden));

  /* ---------- Formulario «Avísame» (prototipo: no envía ni guarda datos) ---------- */
  function iniciarFormulario(){
    const form = document.getElementById('avisoForm');
    if (!form) return;
    const boton = form.querySelector('button[type="submit"]');
    const nombre = document.getElementById('fNombre');
    const correo = document.getElementById('fCorreo');
    const permiso = document.getElementById('fOk');
    const reglas = [
      [nombre, document.getElementById('eNombre'), () => nombre.value.trim() ? '' : 'Escribe tu nombre.'],
      [correo, document.getElementById('eCorreo'),
        () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo.value.trim()) ? '' : 'Revisa tu correo, parece incompleto.'],
      [permiso, document.getElementById('eOk'), () => permiso.checked ? '' : 'Necesitamos tu permiso para escribirte.'],
    ];
    form.addEventListener('submit', e => e.preventDefault());   // va aparte: nunca se envía, aunque falle lo demás
    form.addEventListener('submit', protegido('formulario', () => {
      let primero = null;
      for (const [campo, error, revisar] of reglas){
        const mensaje = revisar();
        error.textContent = mensaje;
        if (mensaje){ campo.setAttribute('aria-invalid', 'true'); primero = primero || campo; }
        else campo.removeAttribute('aria-invalid');
      }
      if (primero){ primero.focus(); return; }
      document.getElementById('okName').textContent = ', ' + nombre.value.trim().split(' ')[0];
      document.getElementById('formBox').classList.add('sent');
      document.querySelector('#formBox .ok-msg').focus();
    }, () => { boton.disabled = true; }));
    // El botón empieza desactivado en el HTML: se activa solo cuando este código atiende el envío
    boton.disabled = false;
  }

  /* ---------- Textos de la portada divididos para sus entradas (una sola vez) ---------- */
  function dividirTextos(){
    const rng = seed => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };
    document.querySelectorAll('[data-split]').forEach((el, i) => {
      const mode = el.dataset.split;
      const text = el.textContent.replace(/\s+/g, ' ').trim();
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = text;
      if (mode === 'stack') {
        const vis = document.createElement('span'); vis.className = 'stack'; vis.setAttribute('aria-hidden', 'true');
        const soft = document.createElement('span'); soft.className = 'soft'; soft.textContent = text;
        const sharp = document.createElement('span'); sharp.className = 'sharp'; sharp.textContent = text;
        vis.append(soft, sharp); el.replaceChildren(sr, vis);
      } else if (mode === 'words') {
        const r = rng(17 + i * 31);
        const words = text.split(' ');
        const vis = document.createElement('span'); vis.className = 'vis'; vis.setAttribute('aria-hidden', 'true');
        words.forEach((w, n) => {
          const s = document.createElement('span'); s.className = 'w';
          s.textContent = w + (n < words.length - 1 ? ' ' : '');
          s.style.setProperty('--th', (n / words.length * 0.5 + r() * 0.04).toFixed(3));
          vis.append(s);
        });
        el.replaceChildren(sr, vis);
      } else if (mode === 'lines') {
        el.querySelectorAll('.line').forEach(l => l.setAttribute('aria-hidden', 'true'));
        el.prepend(sr);
      }
    });
  }

  /* ---------- Portada: fotos nítidas que se funden y se acercan con el scroll ----------
     Plan B: la portada fija (la misma que ven los celulares y quien no usa JavaScript). */
  let apagarPortada = () => html.classList.remove('hero-animado');

  function iniciarPortada(){
    const hero = document.querySelector('.hero');
    const stage = hero && hero.querySelector('.stage');
    const FIJA = html.dataset.portadaFija;   // condiciones de portada fija, definidas en el <head>
    if (!stage || !FIJA){ html.classList.remove('hero-animado'); return; }

    const fog = stage.querySelector('.fog');
    const FADE = 0.06;                       // cuánto scroll dura cada fundido
    const FOG = [0.58, 0.65, 0.672, 0.75];   // la neblina sube, cubre y se despeja
    const FOG_MAX = 0.8;                     // nunca tapa del todo: debajo se ve el cambio de mundo
    const frames = [...stage.querySelectorAll('.frame')].map(el => ({
      el, src: el.dataset.src, a: +el.dataset.a, b: +el.dataset.b,
      z0: +el.dataset.z0, z1: +el.dataset.z1, ok: false, op: -1, sc: -1
    }));
    let lastFog = -1;

    /* altímetro: nombre del tramo y barra de avance */
    const TRAMOS = [[0, 'Páramo'], [0.23, 'Mirador'], [0.45, 'Cumbre'], [0.66, 'Selva']];
    const altName = document.getElementById('altName');
    const altNum = document.getElementById('altNum');
    const altBar = stage.querySelector('.alt .bar i');
    let lastTramo = -1, lastAlt = -1;

    function updateFrames(p){
      frames.forEach((f, i) => {
        const next = frames[i + 1];
        let op = i === 0 ? 1 : smoothstep(p, f.a, f.a + FADE);
        if (next && next.ok && p >= next.a + FADE) op = 0;   // la siguiente ya cubre todo
        if (!f.ok) op = 0;
        op = Math.round(op * 1000) / 1000;
        const sc = Math.round((f.z0 + (f.z1 - f.z0) * clamp((p - f.a) / (f.b - f.a), 0, 1)) * 10000) / 10000;
        if (op !== f.op){ f.op = op; f.el.style.opacity = op; }
        if (sc !== f.sc && op > 0){ f.sc = sc; f.el.style.transform = `scale(${sc})`; }
      });
      const fo = Math.round(FOG_MAX * smoothstep(p, FOG[0], FOG[1]) * (1 - smoothstep(p, FOG[2], FOG[3])) * 1000) / 1000;
      if (fo !== lastFog){
        lastFog = fo;
        fog.style.opacity = fo;
        fog.style.transform = `translateY(${((0.67 - p) * 60).toFixed(2)}vh)`;
      }
      let t = 0; TRAMOS.forEach(([s], i) => { if (p >= s) t = i; });
      if (t !== lastTramo){ lastTramo = t; altName.textContent = TRAMOS[t][1]; altNum.textContent = `0${t + 1} / 04`; }
      const a = Math.round(p * 100);
      if (a !== lastAlt){ lastAlt = a; altBar.style.setProperty('--altp', a + '%'); }
    }

    const bands = [...stage.querySelectorAll('.band')].map((el, i, all) => ({
      el, a: +el.dataset.a, b: +el.dataset.b, ramp: el.dataset.ramp ? +el.dataset.ramp : 0,
      first: i === 0, last: i === all.length - 1, op: -1, k: -1, live: null,
      links: [...el.querySelectorAll('a, button')]
    }));

    let heroOnScreen = true, scrubOn = false, rota = false, target = 0, shown = 0, rafId = null, lastTick = 0, stageMoved = null;
    const loadStart = performance.now(); let loadK = 0;

    function heroProgress(){
      const r = hero.getBoundingClientRect();
      const range = hero.offsetHeight - innerHeight;
      return range > 0 ? clamp(-r.top / range, 0, 1) : 0;
    }

    function updateCaptions(p){
      for (const b of bands){
        // la primera banda abre ya visible; la última no se desvanece al final
        const f = Math.min(0.02, (b.b - b.a) / 3);
        const inE = b.first ? 1 : smoothstep(p, b.a, b.a + f);
        const outE = b.last ? 1 : 1 - smoothstep(p, b.b - f, b.b);
        const op = Math.round(inE * outE * 1000) / 1000;
        let k = clamp((p - b.a) / (b.ramp || Math.min(0.025, (b.b - b.a) * 0.35)), 0, 1);
        if (b.first) k = Math.max(k, loadK);
        if (op !== b.op){ b.op = op; b.el.style.opacity = op; }
        if (Math.abs(k - b.k) > 0.008 || (k === 1 && b.k !== 1) || (k === 0 && b.k !== 0)){ b.k = k; b.el.style.setProperty('--k', k.toFixed(3)); }
        const live = op > 0.5;
        if (live !== b.live){
          b.live = live;
          b.el.classList.toggle('live', live);
          // un botón invisible no debe recibir el foco con la tecla Tab
          b.links.forEach(a => { if (live) a.removeAttribute('tabindex'); else a.setAttribute('tabindex', '-1'); });
        }
      }
      const moved = p > 0.04;
      if (moved !== stageMoved){ stageMoved = moved; stage.classList.toggle('moved', moved); }
    }

    function disableScrub(){
      if (!scrubOn) return; scrubOn = false;
      if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
    }
    apagarPortada = () => {
      rota = true;
      disableScrub();
      html.classList.remove('hero-animado');
    };

    const tick = protegido('portada', now => {
      const dt = Math.min(100, now - (lastTick || now));
      lastTick = now;
      const k = 0.16;
      shown += (target - shown) * (1 - Math.pow(1 - k, dt / 16.667));
      if (loadK < 1) loadK = clamp((now - loadStart) / 1400, 0, 1);
      if (Math.abs(target - shown) < 0.0005 && loadK >= 1){
        shown = target; rafId = null; lastTick = 0;
      } else {
        rafId = requestAnimationFrame(tick);
      }
      updateFrames(shown);
      updateCaptions(shown);
    }, () => apagarPortada());
    function pedirCuadro(){ if (rafId === null && heroOnScreen && scrubOn && !rota) rafId = requestAnimationFrame(tick); }

    alScroll('portada', () => {
      if (!scrubOn || !heroOnScreen || rota) return null;
      const p = heroProgress();
      return () => { target = p; pedirCuadro(); };
    }, () => apagarPortada());
    new IntersectionObserver(protegido('portada', ([e]) => {
      heroOnScreen = e.isIntersecting;
      if (heroOnScreen && scrubOn){ target = heroProgress(); pedirCuadro(); }
    }, () => apagarPortada())).observe(hero);

    /* carga de las fotos: la primera gana el ancho de banda, las demás llegan en orden.
       Solo ocurre con portada animada; los celulares nunca las descargan. */
    let fotosPedidas = false;
    function loadFrame(i){
      const f = frames[i];
      if (!f || rota) return;
      const img = new Image();
      img.decoding = 'async';
      img.onload = protegido('portada', () => {
        f.el.style.backgroundImage = `url('${f.src}')`;
        f.ok = true; f.op = -1;
        if (i === 0) stage.classList.add('loaded');
        updateFrames(shown);
        loadFrame(i + 1);
      }, () => apagarPortada());
      // si falla la primera foto, la portada fija; si falla otra, la anterior sigue visible
      img.onerror = protegido('portada', () => { if (i === 0) apagarPortada(); else loadFrame(i + 1); }, () => apagarPortada());
      img.src = f.src;
    }

    function enableScrub(){
      if (scrubOn) return; scrubOn = true;
      if (!fotosPedidas){ fotosPedidas = true; loadFrame(0); }
      bands.forEach(b => { b.op = -1; b.k = -1; b.live = null; });
      frames.forEach(f => { f.op = -1; f.sc = -1; }); lastFog = -1; lastTramo = -1; lastAlt = -1;
      shown = target = heroProgress();
      updateFrames(shown);
      updateCaptions(shown);
      pedirCuadro();
    }

    // La clase va primero: cambia la altura de la portada, y el avance se calcula con la altura nueva
    const fijaMQ = matchMedia(FIJA);
    function aplicarModo(){
      const animada = !fijaMQ.matches && !rota;
      html.classList.toggle('hero-animado', animada);
      if (animada) enableScrub(); else disableScrub();
    }
    fijaMQ.addEventListener('change', protegido('portada', aplicarModo, () => apagarPortada()));
    aplicarModo();
  }

  /* ---------- Dorsal: cuenta regresiva al evento destacado ----------
     El momento de inicio viene de la base de datos en data-inicio (fecha, hora y zona de Ecuador).
     Los números iniciales ya vienen del servidor; aquí solo se mantienen al día. Plan B: se quedan quietos. */
  function iniciarDorsal(){
    const bib = document.querySelector('.bib[data-inicio]');
    if (!bib) return;
    const INICIO = Date.parse(bib.dataset.inicio);
    if (Number.isNaN(INICIO)) return;
    const els = ['cdD', 'cdH', 'cdM', 'cdS'].map(id => document.getElementById(id));
    const ultimos = els.map(el => el.textContent);
    const pad = n => String(n).padStart(2, '0');
    let reloj = null, detenido = false;
    const detener = () => { detenido = true; clearInterval(reloj); reloj = null; };
    const actualizar = protegido('dorsal', () => {
      const s = Math.max(0, Math.floor((INICIO - Date.now()) / 1000));
      const vals = [String(Math.floor(s / 86400)), pad(Math.floor(s % 86400 / 3600)), pad(Math.floor(s % 3600 / 60)), pad(s % 60)];
      vals.forEach((v, i) => { if (v !== ultimos[i]){ ultimos[i] = v; els[i].textContent = v; } });
    }, detener);
    const reanudar = () => {
      clearInterval(reloj); reloj = null;
      if (!document.hidden && !detenido){ actualizar(); if (!detenido) reloj = setInterval(actualizar, 1000); }
    };
    document.addEventListener('visibilitychange', reanudar);
    reanudar();
  }

  /* ---------- Menú sólido apenas la portada empieza a salir de la pantalla ----------
     (abrir y cerrar el menú en celular está en menu.js, que usan todas las páginas). Plan B: siempre sólido. */
  function iniciarMenuSolido(){
    const nav = document.querySelector('.nav');
    const hero = document.querySelector('.hero');
    if (!nav || !hero) return;
    let solido = null;
    const medir = () => {
      const s = hero.getBoundingClientRect().bottom <= innerHeight + 2;
      return s === solido ? null : () => { solido = s; nav.classList.toggle('solid', s); };
    };
    alScroll('menú', medir, () => nav.classList.add('solid'));
    const escribir = medir();
    if (escribir) escribir();
  }

  /* ---------- Entradas de secciones ---------- Plan B: todas las secciones visibles. */
  const mostrarSecciones = () => html.classList.remove('anim');

  function iniciarEntradas(){
    const io = new IntersectionObserver(protegido('entradas de secciones', entries => {
      for (const e of entries){
        if (!e.isIntersecting) continue;
        const el = e.target;
        el.classList.add('in');
        setTimeout(() => el.classList.add('settled'), 1400);
        io.unobserve(el);
      }
    }, mostrarSecciones), { threshold: 0.12 });
    document.querySelectorAll('.rv').forEach(el => io.observe(el));
  }

  /* ---------- Línea de puestos de control ---------- Plan B: se oculta (es decorativa). */
  function iniciarLineaPC(){
    const main = document.getElementById('main');
    const trail = document.querySelector('.trail');
    if (!main || !trail) return;
    const tSvg = trail.querySelector('svg');
    const ghost = trail.querySelector('.ghost');
    const liveP = trail.querySelector('.live');
    const wpsG = trail.querySelector('.wps');
    let trailLen = 0, wps = [], lastDash = -1, trailOn = false;
    const ocultar = () => { trailOn = false; trail.style.display = 'none'; };

    function medir(){
      if (!trailOn || !trailLen) return null;
      const r = main.getBoundingClientRect();
      const reach = clamp(innerHeight * 0.62 - r.top, 0, main.offsetHeight);
      const frac = reduceMQ.matches ? 1 : reach / main.offsetHeight;
      return () => {
        const dash = Math.round(trailLen * (1 - frac));
        if (dash !== lastDash){ lastDash = dash; liveP.style.strokeDashoffset = dash; }
        for (const w of wps){
          const on = reduceMQ.matches || reach >= w.y;
          if (on !== w.on){ w.on = on; w.c.classList.toggle('on', on); }
        }
      };
    }
    function dibujar(){ const escribir = medir(); if (escribir) escribir(); }

    const buildTrail = protegido('línea de puestos de control', () => {
      trailOn = getComputedStyle(trail).display !== 'none';
      if (!trailOn) return;
      const H = main.offsetHeight, W = 48;
      tSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const secs = [...main.querySelectorAll('section[data-pc]')];
      const pts = secs.map((s, i) => ({ y: s.offsetTop + 120, x: i % 2 ? 36 : 12 }));
      let d = 'M24 0', prev = { x: 24, y: 0 };
      pts.forEach(p => { const my = (prev.y + p.y) / 2; d += ` C${prev.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`; prev = p; });
      ghost.setAttribute('d', d); liveP.setAttribute('d', d);
      trailLen = liveP.getTotalLength();
      liveP.style.strokeDasharray = trailLen;
      wpsG.replaceChildren();
      wps = pts.map((p, i) => {
        const c = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        const s = i === pts.length - 1 ? 16 : 12;
        c.setAttribute('x', p.x - s / 2); c.setAttribute('y', p.y - s / 2); c.setAttribute('width', s); c.setAttribute('height', s);
        c.setAttribute('transform', `rotate(45 ${p.x} ${p.y})`);
        c.setAttribute('class', 'wp');
        wpsG.append(c);
        return { c, y: p.y, on: false };
      });
      lastDash = -1;
      dibujar();
    }, ocultar);

    alScroll('línea de puestos de control', medir, ocultar);
    let rT; addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(buildTrail, 150); });
    addEventListener('load', buildTrail);
    buildTrail();
    const redibujar = protegido('línea de puestos de control', () => { lastDash = -1; wps.forEach(w => { w.on = null; }); dibujar(); }, ocultar);
    return { fijar: redibujar, soltar: redibujar };
  }

  /* ---------- Momento interactivo: mantén presionado para subir ----------
     Solo existe si hay un evento destacado en la página. Plan B: se ve el mensaje final, sin el juego. */
  function iniciarSubida(){
    const climb = document.getElementById('climb');
    if (!climb) return;
    const holdBtn = document.getElementById('holdBtn');
    const prof = document.getElementById('profLive');
    const dot = document.getElementById('runnerDot');
    const profLen = prof.getTotalLength();
    prof.style.strokeDasharray = profLen;
    let hp = 0, holding = false, hRaf = null, hLast = 0, done = false;
    const sinJuego = () => {
      done = true;
      if (hRaf !== null){ cancelAnimationFrame(hRaf); hRaf = null; }
      climb.classList.remove('activo');
    };
    const seguro = fn => protegido('mantén presionado', fn, sinJuego);

    const renderHold = () => {
      prof.style.strokeDashoffset = profLen * (1 - hp);
      const pt = prof.getPointAtLength(profLen * hp);
      dot.setAttribute('cx', pt.x.toFixed(1)); dot.setAttribute('cy', pt.y.toFixed(1));
      holdBtn.style.setProperty('--hp', hp.toFixed(3));
    };
    const finish = () => {
      done = true; hp = 1; renderHold();
      climb.classList.add('done');
      holdBtn.querySelector('span:last-child').textContent = '¡Llegaste a la cumbre!';
    };
    const hTick = seguro(now => {
      const dt = Math.min(64, now - (hLast || now)); hLast = now;
      hp = holding ? Math.min(1, hp + dt / 1600) : Math.max(0, hp - dt / 1100);
      renderHold();
      if (hp >= 1){ hRaf = null; hLast = 0; finish(); return; }
      if (!holding && hp <= 0){ hRaf = null; hLast = 0; return; }
      hRaf = requestAnimationFrame(hTick);
    });
    const startHold = seguro(e => {
      if (done) return;
      if (e && e.type === 'pointerdown'){ e.preventDefault(); try { holdBtn.setPointerCapture(e.pointerId); } catch {} }
      holding = true;
      if (hRaf === null) hRaf = requestAnimationFrame(hTick);
    });
    const endHold = seguro(() => { holding = false; if (!done && hRaf === null && hp > 0) hRaf = requestAnimationFrame(hTick); });

    holdBtn.addEventListener('pointerdown', startHold);
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => holdBtn.addEventListener(t, endHold));
    holdBtn.addEventListener('keydown', seguro(e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat){ e.preventDefault(); startHold(); } }));
    holdBtn.addEventListener('keyup', seguro(e => { if (e.key === ' ' || e.key === 'Enter') endHold(); }));
    // si el foco se va (Tab) o se cambia de pestaña con la tecla apretada, nunca llega el keyup
    holdBtn.addEventListener('blur', endHold);
    document.addEventListener('visibilitychange', () => { if (document.hidden) endHold(); });
    holdBtn.addEventListener('contextmenu', e => e.preventDefault());
    renderHold();
    climb.classList.add('activo');   // recién ahora se muestra el botón (sin JavaScript se ve el mensaje final)
    return { fijar: seguro(() => { if (!done) finish(); }) };
  }

  /* ---------- Movimiento reducido, en vivo y en ambos sentidos ---------- */
  function iniciarMovimientoReducido(partes){
    const fijar = () => {
      document.querySelectorAll('.rv').forEach(el => el.classList.add('in', 'settled'));
      partes.forEach(p => { if (p.fijar) p.fijar(); });
    };
    reduceMQ.addEventListener('change', protegido('movimiento reducido', e => {
      if (e.matches) fijar();
      else partes.forEach(p => { if (p.soltar) p.soltar(); });
    }, mostrarSecciones));
    if (reduceMQ.matches) fijar();
  }

  iniciar('formulario', iniciarFormulario);
  iniciar('textos de la portada', dividirTextos);
  iniciar('portada', iniciarPortada, () => apagarPortada());
  iniciar('dorsal', iniciarDorsal);
  iniciar('menú', iniciarMenuSolido);
  iniciar('entradas de secciones', iniciarEntradas, mostrarSecciones);
  const linea = iniciar('línea de puestos de control', iniciarLineaPC);
  const subida = iniciar('mantén presionado', iniciarSubida);
  iniciar('movimiento reducido', () => iniciarMovimientoReducido([linea, subida]));
  html.classList.add('etr-listo');   // avisa al script del <head> que todo arrancó
})();
