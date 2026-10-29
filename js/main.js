/* Duala Mudanzas — interacción y animación */
(function () {
  // Datos de contacto (de la web actual de Duala)
  var CONFIG = {
    whatsapp: '34632773948',
    phone: '632 77 39 48',
    horario: 'lunes a viernes, de 7:00 a 14:00 y de 17:30 a 21:00',
    waMessage: 'Quiero presupuesto: origen, destino, fecha'
  };

  var waUrl = function (text) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text); };
  var store = {
    get: function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  };

  document.querySelectorAll('.js-wa').forEach(function (a) { a.href = waUrl(CONFIG.waMessage); });
  document.querySelectorAll('.js-phone').forEach(function (el) { el.textContent = CONFIG.phone; });

  // Cabecera con borde al hacer scroll
  var top = document.getElementById('top');
  var onScroll = function () { top.classList.toggle('is-scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Formularios de presupuesto (sección y pop-up): validan y preparan el mensaje en WhatsApp
  document.querySelectorAll('.js-quote').forEach(function (form) {
    var tel = form.elements.tel;
    var telErr = form.querySelector('.js-tel-err');
    var formErr = form.querySelector('.js-form-err');
    var ok = form.querySelector('.js-form-ok');
    var last = form.querySelector('.js-wa-last');

    tel.addEventListener('input', function () {
      if (tel.classList.contains('is-error') && tel.value.replace(/\D/g, '').length >= 9) {
        tel.classList.remove('is-error'); tel.removeAttribute('aria-invalid'); telErr.hidden = true;
      }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var telOk = f.tel.value.replace(/\D/g, '').length >= 9;
      tel.classList.toggle('is-error', !telOk);
      if (telOk) tel.removeAttribute('aria-invalid'); else tel.setAttribute('aria-invalid', 'true');
      telErr.hidden = telOk || !f.tel.value;
      var missing = !f.origen.value.trim() || !f.destino.value.trim() || !f.tel.value.trim();
      formErr.hidden = !missing;
      if (missing || !telOk) { ok.hidden = true; (missing ? form.querySelector('input:invalid, .is-error') : tel).focus(); return; }

      var fecha = f.fecha.value ? new Date(f.fecha.value + 'T12:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : 'por concretar';
      var msg = 'Quiero presupuesto (' + f.servicio.value + ').\nOrigen: ' + f.origen.value.trim() + '\nDestino: ' + f.destino.value.trim() + '\nFecha: ' + fecha + '\nTeléfono: ' + f.tel.value.trim();
      if (f.que.value.trim()) msg += '\nQué se muda: ' + f.que.value.trim();
      var url = waUrl(msg);
      last.href = url;
      ok.hidden = false;
      store.set('duala-pop', 'sent');
      window.open(url, '_blank', 'noopener');
    });
  });

  // Pop-up de presupuesto: se abre al entrar (una vez por visita) y desde los botones .js-open-quote
  var pop = document.getElementById('pop');
  var openPop = function (servicio) {
    if (!pop || pop.open) return;
    if (servicio) pop.querySelector('[name=servicio]').value = servicio;
    if (typeof pop.showModal === 'function') pop.showModal(); else pop.setAttribute('open', '');
    document.documentElement.style.overflow = 'hidden';
  };
  var closePop = function () {
    if (pop.open) { if (typeof pop.close === 'function') pop.close(); else pop.removeAttribute('open'); }
  };
  if (pop) {
    pop.addEventListener('close', function () { document.documentElement.style.overflow = ''; store.set('duala-pop', store.get('duala-pop') || 'closed'); });
    pop.querySelector('.pop__close').addEventListener('click', closePop);
    pop.querySelector('.pop__later').addEventListener('click', closePop);
    pop.addEventListener('click', function (e) { if (e.target === pop) closePop(); });
    document.querySelectorAll('.js-open-quote').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openPop(b.dataset.servicio); });
    });
    if (!store.get('duala-pop')) setTimeout(function () { openPop(); }, 1400);
  }

  // Guardamuebles: estimación por días
  var dias = document.getElementById('gm-dias');
  if (dias) {
    var out = document.getElementById('gm-dias-out'), total = document.getElementById('gm-total');
    var eur = function (n) { return n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'; };
    var calc = function () {
      var d = +dias.value;
      out.textContent = d === 1 ? '1 día' : d + ' días';
      total.textContent = eur(d * 14.9);
      dias.style.background = '';
    };
    dias.addEventListener('input', calc);
    calc();
  }

  // ---------- asistente ----------
  var bot = document.getElementById('bot');
  if (bot) {
    var panel = document.getElementById('bot-panel'), launch = document.getElementById('bot-launch');
    var log = document.getElementById('bot-log'), chips = document.getElementById('bot-chips');
    var bform = document.getElementById('bot-form'), input = document.getElementById('bot-in');
    var started = false, flow = null, data = {};
    var MENU = ['Precio de una mudanza', 'Guardamuebles', 'Portes urgentes', 'Pedir presupuesto', 'Horario y teléfono'];

    var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    var scroll = function () { log.scrollTop = log.scrollHeight; };
    var add = function (html, who) {
      var m = document.createElement('div');
      m.className = 'msg msg--' + who;
      m.innerHTML = html;
      log.appendChild(m); scroll();
    };
    var setChips = function (list) {
      chips.innerHTML = '';
      (list || []).forEach(function (c) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'chip'; b.textContent = c;
        b.addEventListener('click', function () { send(c); });
        chips.appendChild(b);
      });
    };
    var say = function (html, next) {
      setChips([]);
      var t = document.createElement('div');
      t.className = 'msg msg--bot msg--typing'; t.innerHTML = '<i></i><i></i><i></i>';
      log.appendChild(t); scroll();
      setTimeout(function () { t.remove(); add(html, 'bot'); setChips(next === undefined ? MENU : next); }, 450 + Math.min(html.length * 4, 700));
    };
    var waBtn = function (text, label) { return '<a class="msg__cta" href="' + waUrl(text) + '" target="_blank" rel="noopener">' + (label || 'Escribir por WhatsApp') + '</a>'; };

    var INTENTS = [
      { k: /presupuest|cotiz|quiero mudar|me mudo|reserv/, run: function () { startFlow(); } },
      { k: /guardamueble|trastero|guardar|almac/, run: function () { say('<p>Nuestro guardamuebles es seguro, limpio y vigilado las 24 h. Cuesta <strong>desde 14,90 € al día</strong> según el espacio que ocupe lo tuyo.</p><p>Lo recogemos con nuestra furgoneta y te lo llevamos cuando lo necesites.</p>', ['Reservar guardamuebles', 'Precio de una mudanza', 'Horario y teléfono']); } },
      { k: /urgen|hoy|ma[ñn]ana|ya mismo|24/, run: function () { say('<p>Hacemos <strong>portes urgentes 24 h</strong>, desde 19,90 €. Para algo urgente lo más rápido es llamar al <strong>' + CONFIG.phone + '</strong> o escribirnos por WhatsApp.</p>' + waBtn('Tengo un porte urgente: '), ['Pedir presupuesto', 'Horario y teléfono']); } },
      { k: /horario|tel[eé]fono|llam|contact|whats|hablar|persona|humano/, run: function () { say('<p>Teléfono y WhatsApp: <strong>' + CONFIG.phone + '</strong>.</p><p>Atendemos de ' + CONFIG.horario + '. Las urgencias, 24 h.</p>' + waBtn(CONFIG.waMessage)); } },
      { k: /zona|d[oó]nde|pueblo|provincia|dos hermanas|alcal|mairena|tomares|aljarafe|utrera|carmona|[eé]cija|triana|nervi/, run: function () { say('<p>Trabajamos en <strong>Sevilla capital y toda la provincia</strong>: Dos Hermanas, Alcalá de Guadaíra, Mairena del Aljarafe, Tomares, Utrera, Carmona, Écija y el resto.</p><p>Si vas fuera de la provincia, pregúntanos y lo vemos.</p>'); } },
      { k: /mont|desmont|mueble|embal|fr[aá]gil|caja/, run: function () { say('<p>Embalamos lo frágil, desmontamos los muebles y los dejamos <strong>montados en su sitio</strong> en la casa nueva. Va incluido en el presupuesto si lo necesitas, y se detalla por escrito.</p>', ['Pedir presupuesto', 'Precio de una mudanza']); } },
      { k: /limpi|vaciad|retir|pint|recicl/, run: function () { say('<p>También hacemos <strong>limpieza</strong> (desde 49,90 €), <strong>vaciado y retirada</strong> de muebles y <strong>pintura</strong>. Estos dos últimos se presupuestan al ver el volumen o los metros.</p>', ['Pedir presupuesto', 'Horario y teléfono']); } },
      { k: /fr[ií]o|refriger|isoterm|seco|mercanc|empresa|oficina|negocio/, run: function () { say('<p>Para empresas hacemos <strong>mudanzas de oficina</strong> y <strong>transporte frío y seco</strong> con vehículos isotermos y frigoríficos. El precio depende del trayecto, el volumen y la temperatura.</p>' + waBtn('Hola, soy una empresa y necesito transporte: '), ['Pedir presupuesto', 'Horario y teléfono']); } },
      { k: /financ|fraccion|plazos|pagar|pago/, run: function () { say('<p>Sí, puedes <strong>fraccionar o financiar</strong> el coste de la mudanza. Pregúntanos por las condiciones, sin compromiso.</p>' + waBtn('Quiero información sobre financiar mi mudanza'), ['Pedir presupuesto', 'Precio de una mudanza']); } },
      { k: /subcontrat|equipo|qui[eé]n viene|seguro|confian/, run: function () { say('<p>El equipo que va a tu casa es <strong>el nuestro</strong>, de principio a fin. Sin subcontratas ni caras nuevas el día de la mudanza.</p>'); } },
      { k: /precio|cuesta|cu[aá]nto|tarifa|coste|barat|caro/, run: function () { say('<p>Una mudanza en Sevilla empieza en <strong>199,90 €</strong>. El precio final depende de la distancia, el volumen, los accesos y si hay que desmontar y montar muebles.</p><p>Te lo damos <strong>por escrito antes de la mudanza</strong>, y ese es el que pagas.</p>', ['Pedir presupuesto', '¿Se puede financiar?', 'Guardamuebles']); } },
      { k: /^(hola|buenas|hey|buenos)/, run: function () { say('<p>¡Hola! ¿En qué te ayudo?</p>'); } },
      { k: /gracias|perfecto|vale|genial/, run: function () { say('<p>A ti. Si necesitas algo más, aquí estoy.</p>'); } }
    ];

    var STEPS = [
      { key: 'origen', q: '<p>Vamos con tu presupuesto. ¿<strong>Desde dónde</strong> te mudas? Calle y localidad.</p>' },
      { key: 'destino', q: '<p>¿Y <strong>a dónde</strong> vas?</p>' },
      { key: 'fecha', q: '<p>¿Para <strong>qué fecha</strong>, más o menos?</p>', chips: ['Esta semana', 'Este mes', 'Aún no lo sé'] },
      { key: 'tel', q: '<p>Por último, ¿a qué <strong>teléfono o WhatsApp</strong> te mandamos el precio?</p>' }
    ];
    var startFlow = function (servicio) { flow = 0; data = { servicio: servicio || 'Mudanza' }; say(STEPS[0].q, []); input.focus(); };
    var stepFlow = function (text) {
      var step = STEPS[flow];
      if (step.key === 'tel' && text.replace(/\D/g, '').length < 9) { say('<p>Ese teléfono parece incompleto. ¿Me lo escribes otra vez? Con 9 cifras.</p>', []); return; }
      data[step.key] = text;
      flow++;
      if (flow < STEPS.length) { say(STEPS[flow].q, STEPS[flow].chips || []); return; }
      flow = null;
      var msg = 'Quiero presupuesto (' + data.servicio + ').\nOrigen: ' + data.origen + '\nDestino: ' + data.destino + '\nFecha: ' + data.fecha + '\nTeléfono: ' + data.tel;
      say('<p>Listo. Esto es lo que enviaremos al equipo:</p><p><strong>' + esc(data.servicio) + '</strong> · ' + esc(data.origen) + ' → ' + esc(data.destino) + ' · ' + esc(data.fecha) + '</p><p>Pulsa para enviarlo por WhatsApp y te respondemos el mismo día con el precio por escrito.</p>' + waBtn(msg, 'Enviar por WhatsApp'), ['Precio de una mudanza', 'Guardamuebles']);
    };

    var send = function (text) {
      text = text.trim();
      if (!text) return;
      add('<p>' + esc(text) + '</p>', 'me');
      if (flow !== null) { stepFlow(text); return; }
      if (text === 'Reservar guardamuebles') { startFlow('Guardamuebles'); return; }
      var t = text.toLowerCase();
      for (var i = 0; i < INTENTS.length; i++) { if (INTENTS[i].k.test(t)) { INTENTS[i].run(); return; } }
      say('<p>Eso prefiero que te lo conteste el equipo directamente. Escríbenos y te respondemos hoy.</p>' + waBtn(text));
    };

    var toggle = function (open) {
      panel.hidden = !open;
      bot.classList.toggle('is-open', open);
      launch.setAttribute('aria-expanded', String(open));
      launch.setAttribute('aria-label', open ? 'Cerrar el asistente' : 'Abrir el asistente');
      if (open && !started) {
        started = true;
        say('<p>Hola, soy el asistente de <strong>Duala</strong>. Te ayudo con precios, guardamuebles, zonas y horarios, o te preparo el presupuesto.</p><p>¿Qué necesitas?</p>');
      }
      if (open) setTimeout(function () { input.focus(); }, 50);
    };
    launch.addEventListener('click', function () { toggle(panel.hidden); });
    panel.querySelector('.bot__x').addEventListener('click', function () { toggle(false); launch.focus(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden && !(pop && pop.open)) toggle(false); });
    bform.addEventListener('submit', function (e) { e.preventDefault(); var v = input.value; input.value = ''; send(v); });
  }

  // ---------- animación ----------
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap) return;
  var gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  // Entrada: el titular sube palabra a palabra, se pinta la banda albero
  // y las cajas caen una sobre otra y se precintan.
  var intro = gsap.timeline({ defaults: { ease: 'power4.out' } });
  intro
    .from('.hero__title .w > span', { yPercent: 115, duration: 1, stagger: .07 })
    .from('.mark', { opacity: 0, duration: .3 }, '-=.75')
    .from('.mark', { backgroundSize: '0% 86%',color: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim() || '#0B1530', duration: .8, ease: 'power3.inOut' }, '-=.5')
    .from('.hero .reveal', { y: 22, opacity: 0, duration: .8, stagger: .08 }, '-=.7')
    .from('.stack .tile', {
      y: -260, opacity: 0, duration: 1.05, stagger: { each: .13, from: 'start' }, ease: 'bounce.out',
      rotation: function (i) { return [-7, 5, -4, 6][i]; }
    }, .15)
    .from('.stack .tape', { scaleY: 0, duration: .45, stagger: .1, ease: 'power2.out' }, '-=.35')
    .from('.label', { scale: .6, rotation: -14, opacity: 0, duration: .6, ease: 'back.out(2.2)' }, '-=.25');

  // Si el navegador congela la animación (pestaña en segundo plano), el hero queda completo igualmente
  setTimeout(function () { if (intro.progress() < 1) intro.progress(1); }, 4000);

  // Fotos: parallax suave dentro del marco
  gsap.utils.toArray('.duo img, .duo video').forEach(function (img) {
    gsap.fromTo(img, { yPercent: -6, scale: 1.14 }, {
      yPercent: 6, scale: 1.14, ease: 'none',
      scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  // Bloques que entran al aparecer
  ScrollTrigger.batch('.up', {
    start: 'top 88%', once: true,
    onEnter: function (els) { gsap.from(els, { y: 40, opacity: 0, duration: .9, stagger: .1, ease: 'power3.out', clearProps: 'transform,opacity' }); }
  });
  gsap.utils.toArray('.sec__head, .ruta__head, .escrito__copy, .quote__side, .gm__copy, .zonas .wrap:first-child').forEach(function (el) {
    gsap.from(el.children, { y: 30, opacity: 0, duration: .9, stagger: .08, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  // Cifras que cuentan
  gsap.utils.toArray('.count').forEach(function (el) {
    var to = +el.dataset.to, o = { v: 0 };
    gsap.to(o, { v: to, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      onUpdate: function () { el.textContent = Math.round(o.v); } });
  });

  // La furgoneta cruza Sevilla con el scroll
  var van = document.querySelector('.van');
  var wheels = gsap.utils.toArray('.van .wheel');
  // Cada rueda gira sobre su propio eje (centro del círculo en coordenadas del SVG)
  wheels.forEach(function (w) {
    var c = w.querySelector('circle');
    gsap.set(w, { svgOrigin: c.getAttribute('cx') + ' ' + c.getAttribute('cy') });
  });
  gsap.fromTo(van, { x: function () { return -van.getBoundingClientRect().width * 1.05; } }, {
    x: function () { return window.innerWidth; }, ease: 'none',
    scrollTrigger: {
      trigger: '.ruta__scene', start: 'top bottom', end: 'bottom top', scrub: .6, invalidateOnRefresh: true,
      onUpdate: function (st) { gsap.set(wheels, { rotation: st.progress * 1600 }); }
    }
  });
  gsap.to(van, { y: -2, duration: .16, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.from('.sky-far', { yPercent: 10, ease: 'none', scrollTrigger: { trigger: '.ruta__scene', start: 'top bottom', end: 'bottom top', scrub: true } });

  // Presupuesto escrito: se rellena línea a línea y se sella
  var doc = gsap.timeline({ scrollTrigger: { trigger: '.doc', start: 'top 72%', once: true } });
  var amount = document.querySelector('.doc__amount'), o2 = { v: 0 };
  doc
    .from('.doc', { y: 60, rotation: 6, opacity: 0, duration: .9, ease: 'power3.out' })
    .from('.doc__route > div, .doc__rows li', { x: -14, opacity: 0, duration: .45, stagger: .08, ease: 'power2.out' }, '-=.4')
    .to(o2, { v: 199.9, duration: 1, ease: 'power2.out', onUpdate: function () { amount.textContent = o2.v.toFixed(2).replace('.', ','); } }, '-=.2')
    .fromTo('.stamp', { scale: 2.6, opacity: 0, rotation: -26 }, { scale: 1, opacity: .88, rotation: -12, duration: .32, ease: 'power4.in' }, '-=.1')
    .fromTo('.doc', { x: -5, y: 3 }, { x: 0, y: 0, duration: .6, ease: 'elastic.out(1, .25)' });

  // Pasos: la línea avanza y se encienden los números
  var steps = gsap.utils.toArray('.step');
  ScrollTrigger.create({
    trigger: '.steps', start: 'top 75%', end: 'bottom 45%', scrub: true,
    onUpdate: function (st) {
      document.querySelector('.steps').style.setProperty('--rail', st.progress.toFixed(3));
      steps.forEach(function (s, i) { s.classList.toggle('is-on', st.progress >= i / (steps.length - 1) - .02); });
    }
  });

  // Galería: las fotos se destapan como una caja que se abre
  gsap.utils.toArray('.gallery__img').forEach(function (g, i) {
    gsap.from(g, { clipPath: 'inset(0 0 100% 0 round 20px)', duration: 1.1, delay: i * .1, ease: 'power3.inOut', scrollTrigger: { trigger: '.gallery', start: 'top 80%', once: true } });
  });

  // Cierre: el nombre sube y se precinta
  gsap.from('.close__word span', { yPercent: 60, ease: 'none', scrollTrigger: { trigger: '.close', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  gsap.from('.close__word .tape', { scaleY: 0, duration: .5, stagger: .15, ease: 'power2.out', scrollTrigger: { trigger: '.close__word', start: 'top 85%', once: true } });

  // Botón principal: leve atracción al cursor
  if (window.matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.magnet').forEach(function (b) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect();
        gsap.to(b, { x: (e.clientX - r.left - r.width / 2) * .18, y: (e.clientY - r.top - r.height / 2) * .25, duration: .3 });
      });
      b.addEventListener('mouseleave', function () { gsap.to(b, { x: 0, y: 0, duration: .5, ease: 'elastic.out(1, .4)' }); });
    });
  }
})();
