// ── DATOS DE ENSAYOS POR DISCIPLINA ──
const ensayosPorDisciplina = {
  Suelos: {
    'Contenido de humedad':           'ASTM D2216',
    'Límites de Atterberg':           'ASTM D4318',
    'Análisis granulométrico':        'ASTM D422',
    'Clasificación SUCS':             'ASTM D2487',
    'Proctor modificado':             'ASTM D1557',
    'CBR de laboratorio':             'ASTM D1883',
    'Corte directo':                  'ASTM D3080',
    'Consolidación':                  'ASTM D2435',
  },
  Concreto: {
    'Resistencia a compresión':       'ASTM C39',
    'Asentamiento (Slump)':           'ASTM C143',
    'Contenido de aire':              'ASTM C231',
    'Temperatura del concreto':       'ASTM C1064',
    'Resistencia a tracción':         'ASTM C496',
    'Módulo de rotura':               'ASTM C78',
  },
  Roca: {
    'Resistencia a compresión uniaxial': 'ASTM D7012',
    'Índice de carga puntual':        'ASTM D5731',
    'Durabilidad al desmoronamiento': 'ASTM D4644',
    'Densidad y porosidad':           'ASTM D7263',
  },
  Quimicos: {
    'pH de suelo':                    'ASTM D4972',
    'Contenido de sulfatos':          'ASTM D516',
    'Contenido de cloruros':          'ASTM D512',
    'Materia orgánica':               'ASTM D2974',
  },
  Geotecnia: {
    'Permeabilidad (carga variable)': 'ASTM D5084',
    'Permeabilidad (carga constante)':'ASTM D2434',
    'Ensayo de cono (CPT)':           'ASTM D3441',
    'Compresión triaxial (CU)':       'ASTM D4767',
  },
  Agregados: {
    'Granulometría de agregados':     'ASTM C136',
    'Abrasión Los Ángeles':           'ASTM C131',
    'Peso unitario':                  'ASTM C29',
    'Equivalente de arena':           'ASTM D2419',
    'Absorción y gravedad específica':'ASTM C127',
  },
};

// ── ICONOS POR DISCIPLINA ──
const iconoDisc = {
  Suelos:    '🪨',
  Concreto:  '🏗️',
  Roca:      '⛰️',
  Quimicos:  '🧪',
  Geotecnia: '💧',
  Agregados: '🔩',
};

// ── ESTADO LOCAL ──
let items = []; // { disciplina, ensayo, norma, cantidad }

// ── REFERENCIAS DOM ──
const disciplinaSelect  = document.getElementById('disciplina');
const ensayosLista      = document.getElementById('ensayosLista');
const btnAgregarWrap    = document.getElementById('btnAgregarWrap');
const btnAgregar        = document.getElementById('btnAgregar');
const cardItems         = document.getElementById('cardItems');
const cardItemsTitle    = document.getElementById('cardItemsTitle');
const itemsContainer    = document.getElementById('itemsContainer');
const solicitudForm     = document.getElementById('solicitudForm');
const modalOverlay      = document.getElementById('modalOverlay');
const btnModalAceptar   = document.getElementById('btnModalAceptar');
const btnBorrador       = document.getElementById('btnBorrador');

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
  const ensayos = ensayosPorDisciplina[disc] || {};
  ensayosLista.innerHTML = '';

  Object.entries(ensayos).forEach(([nombre, norma]) => {
    const row = document.createElement('div');
    row.className = 'ensayo-item';
    row.dataset.ensayo = nombre;
    row.dataset.norma  = norma;

    row.innerHTML = `
      <div class="ensayo-checkbox">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <div class="ensayo-texts">
        <div class="ensayo-name">${nombre}</div>
        <div class="ensayo-norma">${norma}</div>
      </div>
    `;

    row.addEventListener('click', () => row.classList.toggle('checked'));
    ensayosLista.appendChild(row);
  });
}

// ── AGREGAR SELECCIONADOS ──
btnAgregar.addEventListener('click', () => {
  const disc     = disciplinaSelect.value;
  const checked  = ensayosLista.querySelectorAll('.ensayo-item.checked');
  if (!checked.length) return;

  checked.forEach(row => {
    const ensayo = row.dataset.ensayo;
    const norma  = row.dataset.norma;
    const existe = items.some(i => i.disciplina === disc && i.ensayo === ensayo);
    if (!existe) {
      items.push({ disciplina: disc, ensayo, norma, cantidad: 1 });
    }
  });

  // Reset selección
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

  // Agrupar por disciplina
  const grupos = {};
  items.forEach((item, idx) => {
    if (!grupos[item.disciplina]) grupos[item.disciplina] = [];
    grupos[item.disciplina].push({ ...item, idx });
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

    grupo.forEach(({ ensayo, cantidad, idx }) => {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <span class="item-name">${ensayo}</span>
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

  // Eventos cantidad / eliminar
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
      const idx = parseInt(btn.dataset.idx);
      items.splice(idx, 1);
      renderItems();
    });
  });
}

// ── VALIDACIÓN ──
function validarForm() {
  let ok = true;

  const campos = [
    { id: 'empresa',  errorId: 'empresa-error'  },
    { id: 'nombre',   errorId: 'nombre-error'   },
    { id: 'telefono', errorId: 'telefono-error' },
  ];

  campos.forEach(({ id, errorId }) => {
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

// Limpiar error al escribir
['empresa', 'nombre', 'telefono'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    document.getElementById(id).classList.remove('invalid');
    document.getElementById(`${id}-error`).classList.remove('visible');
  });
});

// ── ENVIAR ──
solicitudForm.addEventListener('submit', (e) => {
  e.preventDefault();
  if (!validarForm()) return;
  if (items.length === 0) {
    alert('Agregue al menos un ensayo.');
    return;
  }
  modalOverlay.classList.remove('hidden');
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

// ── CARGAR BORRADOR AL INICIO ──
window.addEventListener('DOMContentLoaded', () => {
  const borrador = localStorage.getItem('geslasoft_borrador');
  if (!borrador) return;
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
    if (d.items && d.items.length > 0) {
      items = d.items;
      renderItems();
    }
  } catch (_) {}
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
    position:     'fixed',
    bottom:       '24px',
    left:         '50%',
    transform:    'translateX(-50%)',
    background:   c.bg,
    color:        c.color,
    padding:      '11px 22px',
    borderRadius: '10px',
    fontSize:     '14px',
    fontWeight:   '700',
    boxShadow:    '0 4px 14px rgba(0,0,0,.18)',
    zIndex:       '9999',
    whiteSpace:   'nowrap',
    opacity:      '0',
    transition:   'opacity .2s',
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.style.opacity = '1');
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 2500);
}