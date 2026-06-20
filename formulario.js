// ── CONFIGURACIÓN SUPABASE ──
const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';
const ORG_ID        = '8d3fa0a3-ccfc-40ae-b6fb-7a664d93d464';

// ── HEADERS COMUNES ──
const HEADERS = {
  'apikey':        SUPABASE_ANON,
  'Authorization': `Bearer ${SUPABASE_ANON}`,
  'Content-Type':  'application/json',
};

// ── ICONOS POR DISCIPLINA ──
const iconoDisc = {
  Suelos:    '🟫',
  Concreto:  '🏗️',
  Rocas:      '⛰️',
  Químicos:  '🧪',
  Agregados: '🔩',
  Otros:     '🔬',
};

// ── ESTADO LOCAL ──
let items         = [];
let ensayosDelLab = [];
let labActual     = null;

// ── KEY LOCALSTORAGE: DATOS RECURRENTES ──
const KEY_DATOS_RECURRENTES = 'geslasoft_datos_recurrentes';

// ── PRECARGAR DATOS GUARDADOS (si el usuario eligió "recordar") ──
function precargarDatosRecurrentes() {
  const guardado = localStorage.getItem(KEY_DATOS_RECURRENTES);
  if (!guardado) return;
  try {
    const datos = JSON.parse(guardado);
    document.getElementById('empresa').value      = datos.empresa      || '';
    document.getElementById('rucDni').value        = datos.rucDni       || '';
    document.getElementById('direccion').value     = datos.direccion    || '';
    document.getElementById('nombre').value        = datos.nombre       || '';
    document.getElementById('cargo').value          = datos.cargo        || '';
    document.getElementById('telefono').value      = datos.telefono     || '';
    document.getElementById('email').value          = datos.email        || '';
    document.getElementById('recordarDatos').checked = true;
  } catch (_) {
    localStorage.removeItem(KEY_DATOS_RECURRENTES);
  }
}

// ── GUARDAR O BORRAR DATOS RECURRENTES SEGÚN CHECKBOX ──
function manejarDatosRecurrentes() {
  const recordar = document.getElementById('recordarDatos').checked;
  if (recordar) {
    localStorage.setItem(KEY_DATOS_RECURRENTES, JSON.stringify({
      empresa:   document.getElementById('empresa').value.trim(),
      rucDni:    document.getElementById('rucDni').value.trim(),
      direccion: document.getElementById('direccion').value.trim(),
      nombre:    document.getElementById('nombre').value.trim(),
      cargo:     document.getElementById('cargo').value.trim(),
      telefono:  document.getElementById('telefono').value.trim(),
      email:     document.getElementById('email').value.trim(),
    }));
  } else {
    localStorage.removeItem(KEY_DATOS_RECURRENTES);
  }
}

// ── DOM ──
const disciplinaSelect = document.getElementById('disciplina');
const ensayosLista     = document.getElementById('ensayosLista');
const btnAgregarWrap   = document.getElementById('btnAgregarWrap');
const btnAgregar       = document.getElementById('btnAgregar');
const cardItems        = document.getElementById('cardItems');
const cardItemsTitle   = document.getElementById('cardItemsTitle');
const itemsContainer   = document.getElementById('itemsContainer');
const solicitudForm    = document.getElementById('solicitudForm');
const modalOverlay     = document.getElementById('modalOverlay');
const btnModalAceptar  = document.getElementById('btnModalAceptar');

// ── FETCH HELPER ──
async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: { ...HEADERS, ...(options.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || text || res.statusText);
  return data;
}

// ── CARGAR ENSAYOS ──
async function cargarEnsayos(laboratorio_id) {
  if (!laboratorio_id) return;
  const data = await sbFetch(
    `laboratorio_metodos?laboratorio_id=eq.${laboratorio_id}&activo=eq.true&select=metodo_id,version_astm,version_ntp,version_iso,version_aashto,metodos(id,disciplina,codigo,codigo_ntp,codigo_iso,codigo_aashto,descripcion)&order=metodos(id).asc`
  );
  ensayosDelLab = data.map(row => ({
    disciplina:    row.metodos.disciplina,
    descripcion:   row.metodos.descripcion,
    codigo:        row.metodos.codigo,
    codigo_ntp:    row.metodos.codigo_ntp,
    codigo_iso:    row.metodos.codigo_iso,
    codigo_aashto: row.metodos.codigo_aashto,
    version_astm:  row.version_astm,
    version_ntp:   row.version_ntp,
    version_iso:   row.version_iso,
    version_aashto: row.version_aashto,
  }));
  poblarDisciplinas(ensayosDelLab);
}

// ── MAPA ENSAYO → DISCIPLINA ──
function poblarDisciplinas(ensayos) {
  const ordenDisc = ['Suelos', 'Agregados', 'Rocas', 'Concreto', 'Químicos'];
  const disciplinas = [...new Set(ensayos.map(e => e.disciplina))]
    .sort((a, b) => {
      const ia = ordenDisc.indexOf(a);
      const ib = ordenDisc.indexOf(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  disciplinaSelect.innerHTML = '<option value="">Seleccionar disciplina</option>';
  disciplinas.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d;
    opt.textContent = `${iconoDisc[d] || '🔬'} ${d}`;
    disciplinaSelect.appendChild(opt);
  });
}

// ── DISCIPLINA: CAMBIO ──
disciplinaSelect.addEventListener('change', () => {
  const disc = disciplinaSelect.value;
  if (!disc) {
    ensayosLista.classList.add('hidden');
    btnAgregarWrap.classList.add('hidden');
    return;
  }
  renderEnsayosLista(disc);
  ensayosLista.classList.remove('hidden');
  btnAgregarWrap.classList.remove('hidden');
});

// ── RENDER LISTA DE ENSAYOS ──
function renderEnsayosLista(disc) {
  const filtrados = ensayosDelLab.filter(e => e.disciplina === disc);
  ensayosLista.innerHTML = '';
  filtrados.forEach((ensayo) => {
    const codigos = [
      ensayo.codigo,
      ensayo.codigo_ntp,
      ensayo.codigo_iso,
      ensayo.codigo_aashto,
    ].filter(Boolean);

    const opcionesHtml = codigos.map(c =>
      `<option value="${c}" ${c === ensayo.codigo ? 'selected' : ''}>${c}</option>`
    ).join('');

    const row = document.createElement('div');
    row.className = 'ensayo-item';
    row.dataset.ensayo = ensayo.descripcion;
    row.dataset.codigo = ensayo.codigo;
    row.dataset.disc   = disc;
    row.innerHTML = `
      <div class="ensayo-checkbox">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <select class="ensayo-codigo-select" onclick="event.stopPropagation()">
        ${opcionesHtml}
      </select>
      <div class="ensayo-texts">
        <div class="ensayo-name">${ensayo.descripcion}</div>
      </div>
    `;



    const versionMap = {
      [ensayo.codigo]:        ensayo.version_astm  || '',
      [ensayo.codigo_ntp]:    ensayo.version_ntp   || '',
      [ensayo.codigo_iso]:    ensayo.version_iso   || '',
      [ensayo.codigo_aashto]: ensayo.version_aashto || '',
    };

    row.dataset.version = versionMap[ensayo.codigo] || '';

    row.querySelector('.ensayo-codigo-select').addEventListener('change', (e) => {
      row.dataset.codigo   = e.target.value;
      row.dataset.version  = versionMap[e.target.value] || '';
    });

    row.addEventListener('click', () => row.classList.toggle('checked'));
    ensayosLista.appendChild(row);
  });
}

// ── AGREGAR SELECCIONADOS ──
btnAgregar.addEventListener('click', () => {
  const checked = ensayosLista.querySelectorAll('.ensayo-item.checked');
  if (!checked.length) return;
  checked.forEach(row => {
    const ensayo = row.dataset.ensayo;
    const codigo = row.dataset.codigo;
    const disc   = row.dataset.disc;
    const existe = items.some(i => i.area_disciplina === disc && i.ensayo_nombre === ensayo && i.norma === codigo);
    if (!existe) items.push({ area_disciplina: disc, ensayo_nombre: ensayo, norma: codigo, version: row.dataset.version || '', cantidad: 1 });
  });
  ensayosLista.querySelectorAll('.ensayo-item').forEach(r => r.classList.remove('checked'));
  disciplinaSelect.value = '';
  ensayosLista.classList.add('hidden');
  btnAgregarWrap.classList.add('hidden');
  renderItems();
});

// ── RENDER ITEMS AGREGADOS ──
function renderItems() {
  if (items.length === 0) { cardItems.classList.add('hidden'); return; }
  cardItems.classList.remove('hidden');
  cardItemsTitle.textContent = `Ensayos (${items.length})`;
  itemsContainer.innerHTML = '';
  const grupos = {};
  items.forEach((item, idx) => {
    if (!grupos[item.area_disciplina]) grupos[item.area_disciplina] = [];
    grupos[item.area_disciplina].push({ ...item, idx });
  });
  Object.entries(grupos).forEach(([disc, grupo]) => {
    const grupoDiv = document.createElement('div');
    grupoDiv.className = 'disciplina-grupo';
    grupoDiv.innerHTML = `
      <div class="disciplina-label">
        <span>${iconoDisc[disc] || '🔬'}</span>
        <span>${disc.toUpperCase()}</span>
      </div>
    `;
    grupo.forEach(({ ensayo_nombre, cantidad, idx }) => {
      const row = document.createElement('div');
      row.className = 'item-row';



      const norma   = items[idx].norma    || '';
      const version = items[idx].version  || '';

      row.innerHTML = `
              <div class="item-header">
                <span class="item-codigo">${norma}${version}</span>
                <span class="item-name">${ensayo_nombre}</span>
              </div>
              <div class="cant-controls">




          <button type="button" class="cant-btn" data-action="dec" data-idx="${idx}">−</button>
          <span class="cant-value" id="cant-${idx}">${cantidad}</span>
          <button type="button" class="cant-btn" data-action="inc" data-idx="${idx}">+</button>
        </div>
        <button type="button" class="item-delete" data-idx="${idx}" aria-label="Eliminar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      `;
      grupoDiv.appendChild(row);
    });
    itemsContainer.appendChild(grupoDiv);
  });
  itemsContainer.querySelectorAll('.cant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      if (btn.dataset.action === 'inc') items[idx].cantidad++;
      if (btn.dataset.action === 'dec' && items[idx].cantidad > 1) items[idx].cantidad--;
      renderItems();
    });
  });
  itemsContainer.querySelectorAll('.item-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      items.splice(parseInt(btn.dataset.idx), 1);
      renderItems();
    });
  });
}

// ── VALIDACIÓN ──
function validarForm() {
  let ok = true;
  [
    { id: 'empresa',  errorId: 'empresa-error'  },
    { id: 'nombre',   errorId: 'nombre-error'   },
    { id: 'telefono', errorId: 'telefono-error' },
  ].forEach(({ id, errorId }) => {
    const input = document.getElementById(id);
    const error = document.getElementById(errorId);
    if (!input.value.trim()) {
      input.classList.add('invalid');
      error.classList.add('visible');
      ok = false;
    } else {
      input.classList.remove('invalid');
      error.classList.remove('visible');
    }
  });
  return ok;
}

['empresa', 'nombre', 'telefono'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById(id).classList.remove('invalid');
    document.getElementById(`${id}-error`).classList.remove('visible');
  });
});

// ── GENERAR NRO COTIZACIÓN ──
async function generarNroCotizacion() {
  const anio = new Date().getFullYear();
  try {
    const data = await sbFetch(
      `cotizaciones?organizacion_id=eq.${ORG_ID}&nro_cotizacion=like.COT-${anio}-*&select=nro_cotizacion&order=creado_en.desc&limit=1`
    );
    let siguiente = 1;
    if (data.length > 0) {
      const partes = data[0].nro_cotizacion.split('-');
      const ultimo = parseInt(partes[partes.length - 1], 10);
      if (!isNaN(ultimo)) siguiente = ultimo + 1;
    }
    return `COT-${anio}-${String(siguiente).padStart(4, '0')}`;
  } catch (_) {
    return `COT-${anio}-0001`;
  }
}

// ── ENVIAR A SUPABASE ──
async function enviarSolicitud() {
  const btnEnviar = document.getElementById('btnEnviar');
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    const organizacion_id = labActual?.organizacion_id || ORG_ID;

    // ── 1. Insertar solicitud ──
    const solicitud = await sbFetch('solicitudes', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        organizacion_id,
        empresa_solicitante:  document.getElementById('empresa').value.trim(),
        ruc_dni:              document.getElementById('rucDni').value.trim()        || null,
        direccion:            document.getElementById('direccion').value.trim()     || null,
        nombre_solicitante:   document.getElementById('nombre').value.trim(),
        cargo_solicitante:    document.getElementById('cargo').value.trim()         || null,
        telefono:             document.getElementById('telefono').value.trim(),
        email:                document.getElementById('email').value.trim()         || null,
        observaciones:        document.getElementById('observaciones').value.trim() || null,
        laboratorio_codigo:   labActual?.codigo || null,   
        origen:               'portal_cliente',
        estado:               'nueva',
        version:              1,
      }),
    });
    const solicitud_id = (Array.isArray(solicitud) ? solicitud[0] : solicitud).id;
    const nro_solicitud = (Array.isArray(solicitud) ? solicitud[0] : solicitud).nro_solicitud;

    // ── 2. Insertar solicitud_items ──
    const solItems = await sbFetch('solicitud_items', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify(items.map(item => ({
        organizacion_id,
        solicitud_id,
        area_disciplina: item.area_disciplina,
        ensayo_nombre:   item.ensayo_nombre,
        norma:           item.norma || '',
        cantidad:        item.cantidad,
      }))),
    });

    // ── 3. Crear cotización en borrador ──
    const nroCotizacion = await generarNroCotizacion();
    const cotizacion = await sbFetch('cotizaciones', {
      method: 'POST',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({
        organizacion_id,
        nro_cotizacion:     nroCotizacion,
        solicitud_id,
        nombre_cliente:     document.getElementById('empresa').value.trim(),
        empresa_cliente:    document.getElementById('empresa').value.trim(),
        ruc_cliente:        document.getElementById('rucDni').value.trim()  || null,
        email_cliente:      document.getElementById('email').value.trim()   || null,
        moneda:             'PEN',
        estado:             'borrador',
        version:            1,
        incluye_igv:        true,
        plazo_entrega_dias: 5,
        validez_dias:       15,
      }),
    });
    const cotizacion_id = (Array.isArray(cotizacion) ? cotizacion[0] : cotizacion).id;

    // ── 4. Insertar cotizacion_items ──
    const solItemsArr = Array.isArray(solItems) ? solItems : [];
    await sbFetch('cotizacion_items', {
      method: 'POST',
      body: JSON.stringify(items.map(item => {
        const solItem = solItemsArr.find(si =>
          si.ensayo_nombre === item.ensayo_nombre && si.area_disciplina === item.area_disciplina
        );
        return {
          organizacion_id,
          cotizacion_id,
          solicitud_item_id: solItem?.id || null,
          area_disciplina:   item.area_disciplina,
          ensayo_nombre:     item.ensayo_nombre,
          norma:             item.norma || '',
          cantidad:          item.cantidad,
          precio_unitario:   0,
        };
      })),
    });

    // ── Éxito ──
    document.querySelector('.modal-desc').innerHTML =
      `Registrada correctamente con el número <strong>${nro_solicitud}</strong>.<br>El laboratorio la atenderá a la brevedad.`;
    modalOverlay.classList.remove('hidden');
    localStorage.removeItem('geslasoft_borrador');
    manejarDatosRecurrentes();

  } catch (err) {
    console.error(err);
    mostrarToast(err.message || 'Error al enviar. Intenta de nuevo.', 'danger');
  } finally {
    btnEnviar.disabled = false;
    btnEnviar.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Enviar solicitud`;
  }
}

// ── SUBMIT ──
solicitudForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validarForm()) return;
  if (items.length === 0) { mostrarToast('Agrega al menos un ensayo.', 'warning'); return; }
  enviarSolicitud();
});

// ── MODAL ACEPTAR ──
btnModalAceptar.addEventListener('click', () => {
  modalOverlay.classList.add('hidden');
  solicitudForm.reset();
  items = [];
  renderItems();
  disciplinaSelect.value = '';
  ensayosLista.classList.add('hidden');
  btnAgregarWrap.classList.add('hidden');
});



// ── INIT ──
window.addEventListener('DOMContentLoaded', async () => {
  const labGuardado = localStorage.getItem('geslasoft_lab');
    console.log('labGuardado:', labGuardado);





    if (labGuardado) {
      labActual = JSON.parse(labGuardado);

      document.querySelector('.lab-name').textContent     = labActual.nombre    || 'Laboratorio';
      document.querySelector('.lab-location').textContent = labActual.ubicacion || '';
      document.querySelector('.lab-label').textContent    = labActual.codigo
        ? `LABORATORIO · ${labActual.codigo}`
        : 'LABORATORIO SELECCIONADO';

      // ── LOGO ──
      const labIcon = document.querySelector('.lab-icon');
      if (labActual.logo_url) {
        labIcon.innerHTML = `<img src="${labActual.logo_url}" alt="${labActual.nombre}" />`;
      }

      await cargarEnsayos(labActual.id);
    }
  
  else {
    window.location.href = 'laboratorios.html';
    return;
  }

  precargarDatosRecurrentes();
});

// ── VOLVER A SELECCIONAR LABORATORIO ──
document.getElementById('cardLab')?.addEventListener('click', () => {
  window.location.href = 'laboratorios.html';
});

// ── TOAST ──
function mostrarToast(msg, tipo = 'accent') {
  const colores = {
    accent:  { bg: '#00897B', color: '#fff' },
    warning: { bg: '#F59E0B', color: '#fff' },
    danger:  { bg: '#EF4444', color: '#fff' },
  };
  const c = colores[tipo] || colores.accent;
  const toast = document.createElement('div');
  toast.textContent = msg;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', left: '50%',
    transform: 'translateX(-50%)',
    background: c.bg, color: c.color,
    padding: '11px 22px', borderRadius: '10px',
    fontSize: '14px', fontWeight: '700',
    boxShadow: '0 4px 14px rgba(0,0,0,.18)',
    zIndex: '9999', whiteSpace: 'nowrap',
    opacity: '0', transition: 'opacity .2s',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}