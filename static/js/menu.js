/* Menú del celular: se usa en todas las páginas.
   Cerrado, el CSS lo deja invisible y fuera del recorrido con Tab (visibility: hidden). */
(() => {
  'use strict';
  const nav = document.querySelector('.nav');
  const menuBtn = document.querySelector('.menu-btn');
  const menu = document.getElementById('menu');
  if (!nav || !menuBtn || !menu) return;
  const abierto = () => nav.classList.contains('open');
  function setMenu(open){ nav.classList.toggle('open', open); menuBtn.setAttribute('aria-expanded', String(open)); }
  menuBtn.addEventListener('click', () => setMenu(!abierto()));
  menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !abierto()) return;
    // si el foco estaba dentro del menú, vuelve al botón (un menú cerrado no se puede enfocar)
    const focoDentro = menu.contains(document.activeElement);
    setMenu(false);
    if (focoDentro) menuBtn.focus();
  });
  addEventListener('scroll', () => { if (abierto()) setMenu(false); }, { passive: true });
  document.documentElement.classList.add('menu-listo');   // recién ahora el CSS pliega el menú (ver base.html)
})();
