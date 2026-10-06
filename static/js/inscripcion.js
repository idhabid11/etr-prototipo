/* Formulario de inscripción: muestra el total mientras la persona elige, pide confirmación antes de
   borrar lo llenado y evita los envíos dobles. Solo son ayudas: el servidor vuelve a calcular el precio
   y lo muestra en «Revisar»; sin JavaScript el formulario funciona igual. */
(function () {
  // «¿Quieres borrar lo que llenaste?» (en el botón o en el formulario)
  document.addEventListener('submit', function (e) {
    var boton = e.submitter;
    var texto = (boton && boton.getAttribute('data-confirmar')) || e.target.getAttribute('data-confirmar');
    if (texto && !window.confirm(texto)) { e.preventDefault(); return; }
    // Evita el doble clic (dos envíos seguidos)
    if (boton && boton.type === 'submit') setTimeout(function () { boton.disabled = true; }, 0);
  });

  var datos = document.getElementById('precios-evento');
  var form = document.getElementById('form-inscripcion');
  if (!datos || !form) return;
  var precios = JSON.parse(datos.textContent);
  var lista = document.getElementById('lineas-total');
  var total = document.getElementById('valor-total');

  function dinero(n) { return n === 0 ? 'Gratis' : '$' + n.toFixed(2); }
  function texto(input) {
    var span = input.closest('label').querySelector('span');
    return (span ? span.textContent : '').split(' · ')[0];
  }
  function linea(nombre, valor, clase) {
    var li = document.createElement('li');
    if (clase) li.className = clase;
    var a = document.createElement('span'); a.textContent = nombre; li.appendChild(a);
    if (valor !== null) { var b = document.createElement('b'); b.textContent = dinero(valor); li.appendChild(b); }
    lista.appendChild(li);
  }

  function actualizar() {
    lista.innerHTML = '';
    var elegida = form.querySelector('input[name="opcion"]:checked');
    var opcion = elegida && precios.opciones[elegida.value];
    if (!opcion) {
      linea('Elige tu inscripción para ver el total.', null, 'vacio');
      total.textContent = '—';
      return;
    }
    var suma = parseFloat(opcion.precio);
    linea(opcion.texto, suma);
    form.querySelectorAll('input[name="servicios"]:checked').forEach(function (s) {
      var v = parseFloat(precios.servicios[s.value] || '0');
      linea(texto(s), v); suma += v;
    });
    total.textContent = '$' + suma.toFixed(2);
  }

  form.addEventListener('change', actualizar);
  form.addEventListener('reset', function () { setTimeout(actualizar, 0); });
  actualizar();
})();
