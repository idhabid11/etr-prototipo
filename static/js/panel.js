/* Panel de gestión ETR: ayudas de la interfaz. Todo funciona también sin JavaScript
   (los formularios se envían igual); esto solo hace la experiencia más cómoda. */
(function () {
  var html = document.documentElement;
  html.classList.add('js');

  // Menú del celular
  var barra = document.querySelector('.barra');
  var botonMenu = document.querySelector('.menu-panel');
  if (barra && botonMenu) {
    botonMenu.addEventListener('click', function () {
      var abierta = barra.classList.toggle('abierta');
      botonMenu.setAttribute('aria-expanded', abierta ? 'true' : 'false');
    });
  }

  // Confirmar antes de acciones que no se deshacen fácilmente
  document.addEventListener('submit', function (e) {
    var form = e.target;
    var boton = e.submitter;
    var texto = (boton && boton.getAttribute('data-confirmar')) || form.getAttribute('data-confirmar');
    if (texto && !window.confirm(texto)) { e.preventDefault(); return; }
    form.dataset.enviado = '1';
  });

  // Agregar filas (distancias, categorías, extras, puntos de salida)
  document.querySelectorAll('[data-agregar]').forEach(function (boton) {
    boton.hidden = false;
    boton.addEventListener('click', function () {
      var prefijo = boton.getAttribute('data-agregar');
      var plantilla = document.getElementById('vacia-' + prefijo);
      var total = document.getElementById('id_' + prefijo + '-TOTAL_FORMS');
      var lista = document.getElementById('filas-' + prefijo);
      if (!plantilla || !total || !lista) return;
      var n = parseInt(total.value, 10);
      var nueva = plantilla.content.firstElementChild.cloneNode(true);
      nueva.innerHTML = nueva.innerHTML.replace(/__prefix__/g, n).replace(/__numero__/g, n + 1);
      lista.appendChild(nueva);
      total.value = n + 1;
      var vacio = document.getElementById('vacio-' + prefijo);
      if (vacio) vacio.hidden = true;
      var primero = nueva.querySelector('input:not([type=hidden]),select,textarea');
      if (primero) primero.focus();
    });
  });

  // Marcar visualmente la fila que se va a eliminar
  document.addEventListener('change', function (e) {
    if (e.target.matches('.fila .borrar input[type=checkbox]')) {
      e.target.closest('.fila').classList.toggle('marcada-borrar', e.target.checked);
    }
  });

  // Mostrar solo los campos que corresponden (según el tipo de pregunta o de transporte)
  function alternar(selector, valores, contenedor) {
    var el = document.querySelector(selector);
    if (!el) return;
    function revisar() {
      var marcado = el.type === 'radio' ? document.querySelector(selector + ':checked') : el;
      var valor = marcado ? marcado.value : '';
      document.querySelectorAll(contenedor).forEach(function (bloque) {
        var mostrar = bloque.getAttribute('data-mostrar-si').split(' ').indexOf(valor) !== -1;
        bloque.hidden = !mostrar;
      });
    }
    document.querySelectorAll(selector).forEach(function (x) { x.addEventListener('change', revisar); });
    revisar();
  }
  alternar('#id_tipo', [], '[data-segun="tipo"]');
  alternar('input[name="transporte_modo"]', [], '[data-segun="transporte"]');

  // Avisar si se va a salir con cambios sin guardar
  document.querySelectorAll('form[data-avisar-cambios]').forEach(function (form) {
    var cambiado = false;
    form.addEventListener('input', function () { cambiado = true; });
    form.addEventListener('change', function () { cambiado = true; });
    window.addEventListener('beforeunload', function (e) {
      if (cambiado && !form.dataset.enviado) { e.preventDefault(); e.returnValue = ''; }
    });
  });
})();
