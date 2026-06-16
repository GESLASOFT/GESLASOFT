// ── CONFIGURACIÓN SUPABASE ──
const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'sb_publishable_F_XCpSj5urOLhYGZVeyoqQ_AEJRSebP';

const ORG_ID = '8d3fa0a3-ccfc-40ae-b6fb-7a664d93d464';

// ── ICONOS POR DISCIPLINA (para agrupar visualmente) ──
const iconoDisc = {
  Suelos:    '🪨',
  Concreto:  '🏗️',
  Roca:      '⛰️',
  Quimicos:  '🧪',
  Agregados: '🔩',
  Otros:     '🔬',
};

// ── ESTADO LOCAL ──
let items          = [];  // { area_disciplina, ensayo_nombre, norma, cantidad }
let ensayosDelLab  = [];  // cargados desde Supabase
let labActual      = null; // objeto guardado en localStorage

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
const btnBorrador      = document.getElementById('btnBorrador');

// ── CARGAR ENSAYOS DESDE SUPABASE ──
async function cargarEnsayos(organizacion_id) {
  if (!organizacion_id) return;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/precios_ensayo?organizacion_id=eq.${organizacion_id}&select=ensayo_nombre,norma&order=ensayo_nombre.asc`,
    {
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      }
    }
  );
  const data = await res.json();
  if (!res.ok) { console.error('Error cargando ensayos:', data); return; }
  ensayosDelLab = data;

  poblarDisciplinas(data);
}

// ── MAPA EXACTO: ensayo → disciplina ──
const DISCIPLINA_MAP = {
  // Suelos
  'CBR':                      'Suelos',
  'Consolidación':            'Suelos',
  'Contenido de humedad':     'Suelos',
  'Corte directo':            'Suelos',
  'Granulometría':            'Suelos',
  'Gravedad específica':      'Suelos',
  'Límites de Atterberg':     'Suelos',
  'Permeabilidad':            'Suelos',
  'Proctor estándar':         'Suelos',
  'Proctor modificado':       'Suelos',
  'Resistencia no drenada':   'Suelos',
  'Triaxial':                 'Suelos',
  // Concreto
  'Contenido de aire':        'Concreto',
  'Densidad del concreto':    'Concreto',
  'Resistencia a la compresión': 'Concreto',
  'Slump (asentamiento)':     'Concreto',
  'Temperatura del concreto': 'Concreto',
  // Roca
  'Compresión uniaxial':      'Roca',
  'Durabilidad':              'Roca',
  'Point load':               'Roca',
  'Tracción indirecta (brasileño)': 'Roca',
  // Agregados
  'Abrasión Los Ángeles':     'Agregados',
  'Granulometría (Agregados)':'Agregados',
  'Gravedad específica fino': 'Agregados',
  'Gravedad específica grueso':'Agregados',
  'Impurezas orgánicas':      'Agregados',
  // Químicos
  'Calidad del agua':         'Quimicos',
  'Cloruros':                 'Quimicos',
  'Materia orgánica':         'Quimicos',
  'pH del suelo/agua':        'Quimicos',
  'Sales solubles totales':   'Quimicos',
  'Sulfatos solubles':        'Quimicos',
};

function inferirDisciplina(nombre) {
  return DISCIPLINA_MAP[nombre] || 'Otros';
}

function poblarDisciplinas(ensayos) {
  const disciplinas = [...new Set(ensayos.map(e => inferirDisciplina(e.ensayo_nombre)))].sort();

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
  const ensayosFiltrados = ensayosDelLab.filter(e => inferirDisciplina(e.ensayo_nombre) === disc);
  ensayosLista.innerHTML = '';

  ensayosFiltrados.forEach(({ ensayo_nombre, norma }) => {
    const row = document.createElement('div');
    row.className = 'ensayo-item';
    row.dataset.ensayo = ensayo_nombre;
    row.dataset.norma  = norma || '';
    row.dataset.disc   = disc;

    row.innerHTML = `
      <div class="ensayo-checkbox">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="ensayo-texts">
        <div class="ensayo-name">${ensayo_nombre}</div>
        <div class="ensayo-norma">${norma || ''}</div>
      </div>
    `;

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
    const norma  = row.dataset.norma;
    const disc   = row.dataset.disc;
    const existe = items.some(i => i.area_disciplina === disc && i.ensayo_nombre === ensayo);
    if (!existe) {
      items.push({ area_disciplina: disc, ensayo_nombre: ensayo, norma, cantidad: 1 });
    }
  });

  ensayosLista.querySelectorAll('.ensayo-item').forEach(r => r.classList.remove('checked'));
  disciplinaSelect.value = '';
  ensayosLista.classList.add('hidden');
  btnAgregarWrap.classList.add('hidden');

  renderItems();
});

// ── RENDER ITEMS AGREGADOS ──
function renderItems() {
  if (items.length === 0) {
    cardItems.classList.add('hidden');
    return;
  }

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
      row.innerHTML = `
        <span class="item-name">${ensayo_nombre}</span>
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
      const idx    = parseInt(btn.dataset.idx);
      const action = btn.dataset.action;
      if (action === 'inc') items[idx].cantidad++;
      if (action === 'dec' && items[idx].cantidad > 1) items[idx].cantidad--;
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

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/cotizaciones?organizacion_id=eq.${ORG_ID}&nro_cotizacion=like.COT-${anio}-*&select=nro_cotizacion&order=creado_en.desc&limit=1`,
    {
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      }
    }
  );
  const data = await res.json();

  let siguiente = 1;
  if (res.ok && data.length > 0) {
    // Extraer el número del último: "COT-2026-0025" → 25
    const partes = data[0].nro_cotizacion.split('-');
    const ultimo = parseInt(partes[partes.length - 1], 10);
    if (!isNaN(ultimo)) siguiente = ultimo + 1;
  }

  return `COT-${anio}-${String(siguiente).padStart(4, '0')}`;
}

// ── ENVIAR A SUPABASE ──
async function enviarSolicitud() {
  const btnEnviar = document.getElementById('btnEnviar');
  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    const organizacion_id = labActual?.organizacion_id || ORG_ID;

    // ── 1. Insertar en solicitudes ──────────────────────────────────────────
    const solicitudPayload = {
      organizacion_id,
      empresa_solicitante:  document.getElementById('empresa').value.trim(),
      ruc_dni:              document.getElementById('rucDni').value.trim()        || null,
      direccion:            document.getElementById('direccion').value.trim()     || null,
      nombre_solicitante:   document.getElementById('nombre').value.trim(),
      cargo_solicitante:    document.getElementById('cargo').value.trim()         || null,
      telefono:             document.getElementById('telefono').value.trim(),
      email:                document.getElementById('email').value.trim()         || null,
      observaciones:        document.getElementById('observaciones').value.trim() || null,
      origen:               'portal_cliente',
      estado:               'nueva',
      version:              1,
    };

    const resSol = await fetch(`${SUPABASE_URL}/rest/v1/solicitudes`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(solicitudPayload),
    });

    const respSol = await resSol.json();
    if (!resSol.ok) throw new Error(respSol?.message || JSON.stringify(respSol));
    const solicitud = Array.isArray(respSol) ? respSol[0] : respSol;
    const solicitud_id = solicitud.id;

    // ── 2. Insertar solicitud_items ─────────────────────────────────────────
    const solicitudItemsPayload = items.map(item => ({
      organizacion_id,
      solicitud_id,
      area_disciplina: item.area_disciplina,
      ensayo_nombre:   item.ensayo_nombre,
      norma:           item.norma || '',
      cantidad:        item.cantidad,
    }));

    const resItems = await fetch(`${SUPABASE_URL}/rest/v1/solicitud_items`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(solicitudItemsPayload),
    });

    const respSolicitudItems = await resItems.json();
    if (!resItems.ok) throw new Error(respSolicitudItems?.message || 'Error al guardar los ensayos');

    // Construir mapa ensayo_nombre → solicitud_item_id para relacionar
    // (respSolicitudItems es array con los items insertados + sus ids)
    const solicitudItemsInsertados = Array.isArray(respSolicitudItems) ? respSolicitudItems : [];

    // ── 3. Crear cotización en borrador ─────────────────────────────────────
    const nroCotizacion = await generarNroCotizacion();

    const cotizacionPayload = {
      organizacion_id,
      nro_cotizacion:  nroCotizacion,
      solicitud_id,
      nombre_cliente:  document.getElementById('empresa').value.trim(),
      empresa_cliente: document.getElementById('empresa').value.trim(),
      ruc_cliente:     document.getElementById('rucDni').value.trim()    || null,
      email_cliente:   document.getElementById('email').value.trim()     || null,
      moneda:          'PEN',
      estado:          'borrador',
      version:         1,
      incluye_igv:     true,
      plazo_entrega_dias: 5,
      validez_dias:       15,
    };

    const resCot = await fetch(`${SUPABASE_URL}/rest/v1/cotizaciones`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
        'Prefer':        'return=representation',
      },
      body: JSON.stringify(cotizacionPayload),
    });

    const respCot = await resCot.json();
    if (!resCot.ok) throw new Error(respCot?.message || 'Error al crear la cotización');
    const cotizacion = Array.isArray(respCot) ? respCot[0] : respCot;
    const cotizacion_id = cotizacion.id;

    // ── 4. Insertar cotizacion_items ────────────────────────────────────────
    const cotizacionItemsPayload = items.map((item, idx) => {
      // Relacionar con el solicitud_item correspondiente (por posición o por nombre)
      const solItem = solicitudItemsInsertados.find(si =>
        si.ensayo_nombre === item.ensayo_nombre && si.area_disciplina === item.area_disciplina
      );

      return {
        organizacion_id,
        cotizacion_id,
        solicitud_item_id:  solItem?.id || null,
        area_disciplina:    item.area_disciplina,
        ensayo_nombre:      item.ensayo_nombre,
        norma:              item.norma || '',
        cantidad:           item.cantidad,
        precio_unitario:    0,     // el laboratorio lo completará al preparar la cotización
      };
    });

    const resCotItems = await fetch(`${SUPABASE_URL}/rest/v1/cotizacion_items`, {
      method: 'POST',
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(cotizacionItemsPayload),
    });

    if (!resCotItems.ok) {
      const errCotItems = await resCotItems.json();
      throw new Error(errCotItems?.message || 'Error al guardar los ítems de cotización');
    }

    // ── Éxito ───────────────────────────────────────────────────────────────
    document.querySelector('.modal-desc').innerHTML =
      `Registrada correctamente con el número <strong>${solicitud.nro_solicitud}</strong>.<br>El laboratorio la atenderá a la brevedad.`;
    modalOverlay.classList.remove('hidden');
    localStorage.removeItem('geslasoft_borrador');

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

// ── GUARDAR BORRADOR ──
btnBorrador.addEventListener('click', () => {
  const datos = {
    empresa:       document.getElementById('empresa').value,
    rucDni:        document.getElementById('rucDni').value,
    direccion:     document.getElementById('direccion').value,
    nombre:        document.getElementById('nombre').value,
    cargo:         document.getElementById('cargo').value,
    telefono:      document.getElementById('telefono').value,
    email:         document.getElementById('email').value,
    observaciones: document.getElementById('observaciones').value,
    items,
  };
  localStorage.setItem('geslasoft_borrador', JSON.stringify(datos));
  mostrarToast('Borrador guardado', 'warning');
});

// ── INIT: CARGAR DATOS AL ABRIR ──
window.addEventListener('DOMContentLoaded', async () => {

  const labGuardado = localStorage.getItem('geslasoft_lab');
  if (labGuardado) {
    labActual = JSON.parse(labGuardado);
    document.querySelector('.lab-name').textContent     = labActual.nombre    || 'Laboratorio';
    document.querySelector('.lab-location').textContent = labActual.ubicacion || '';

    await cargarEnsayos(labActual.organizacion_id);
  } else {
    window.location.href = 'laboratorios.html';
    return;
  }

  const borrador = localStorage.getItem('geslasoft_borrador');
  if (borrador) {
    try {
      const d = JSON.parse(borrador);
      document.getElementById('empresa').value       = d.empresa       || '';
      document.getElementById('rucDni').value        = d.rucDni        || '';
      document.getElementById('direccion').value     = d.direccion     || '';
      document.getElementById('nombre').value        = d.nombre        || '';
      document.getElementById('cargo').value         = d.cargo         || '';
      document.getElementById('telefono').value      = d.telefono      || '';
      document.getElementById('email').value         = d.email         || '';
      document.getElementById('observaciones').value = d.observaciones || '';
      if (d.items?.length > 0) { items = d.items; renderItems(); }
    } catch (_) {}
  }
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
