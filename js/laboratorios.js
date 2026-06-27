// ── CONFIGURACIÓN SUPABASE ──
const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';

// ── ESTADO ──
let todosLosLabs       = [];
let filtroBusqueda     = '';   // unifica nombre + método
let filtroAcreditacion = 'todos';

// ── DOM ──
const selDep      = document.getElementById('filDepartamento');
const selProv     = document.getElementById('filProvincia');
const selDist     = document.getElementById('filDistrito');
const inputBusq   = document.getElementById('filBusqueda');   // ← nuevo campo unificado
const btnLimpiar  = document.getElementById('btnLimpiar');
const listaLabs   = document.getElementById('listaLabs');
const cargando    = document.getElementById('estadoCargando');
const vacio       = document.getElementById('estadoVacio');
const resHeader   = document.getElementById('resultadosHeader');
const resCount    = document.getElementById('resultadosCount');

// ── TABS ACREDITACIÓN ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    btn.classList.add('tab-btn--active');
    filtroAcreditacion = btn.dataset.filtro;
    aplicarFiltros();
  });
});

// ── FETCH SUPABASE ──
// Trae laboratorios activos; usa campo "estado" en lugar del booleano "acreditado"
async function fetchLabs() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/laboratorios?activo=eq.true&select=*&order=nombre.asc`,
    {
      headers: {
        'apikey':        SUPABASE_ANON,
        'Authorization': `Bearer ${SUPABASE_ANON}`,
        'Content-Type':  'application/json',
      }
    }
  );
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return data;
}

// ── INIT ──
async function init() {
  mostrarCargando(true);
  try {
    todosLosLabs = await fetchLabs();
    poblarDepartamentos();
    renderCards(todosLosLabs);
  } catch (e) {
    cargando.innerHTML = `<p style="color:var(--danger)">Error al cargar laboratorios.<br>${e.message}</p>`;
  } finally {
    mostrarCargando(false);
  }
}

// ── POBLAR DEPARTAMENTOS ──
function poblarDepartamentos() {
  const deps = [...new Set(todosLosLabs.map(l => l.departamento).filter(Boolean))].sort();
  deps.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    selDep.appendChild(opt);
  });
}

// ── CASCADA: DEP → PROV ──
selDep.addEventListener('change', () => {
  const dep = selDep.value;
  resetSelect(selProv, 'Todas las provincias');
  resetSelect(selDist, 'Todos los distritos');
  selDist.disabled = true;
  if (!dep) {
    selProv.disabled = true;
  } else {
    const provs = [...new Set(
      todosLosLabs.filter(l => l.departamento === dep).map(l => l.provincia)
    )].sort();
    provs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      selProv.appendChild(opt);
    });
    selProv.disabled = false;
  }
  aplicarFiltros();
});

// ── CASCADA: PROV → DIST ──
selProv.addEventListener('change', () => {
  const dep  = selDep.value;
  const prov = selProv.value;
  resetSelect(selDist, 'Todos los distritos');
  if (!prov) {
    selDist.disabled = true;
  } else {
    const dists = [...new Set(
      todosLosLabs
        .filter(l => l.departamento === dep && l.provincia === prov)
        .map(l => l.distrito)
    )].sort();
    dists.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d; opt.textContent = d;
      selDist.appendChild(opt);
    });
    selDist.disabled = false;
  }
  aplicarFiltros();
});

selDist.addEventListener('change', aplicarFiltros);

// ── FILTRO BÚSQUEDA UNIFICADA (debounce) ──
let busqTimer;
inputBusq.addEventListener('input', () => {
  clearTimeout(busqTimer);
  busqTimer = setTimeout(() => {
    filtroBusqueda = inputBusq.value.trim().toLowerCase();
    aplicarFiltros();
  }, 300);
});

// ── LIMPIAR ──
btnLimpiar.addEventListener('click', () => {
  selDep.value = '';
  resetSelect(selProv, 'Todas las provincias');
  resetSelect(selDist, 'Todos los distritos');
  selProv.disabled = true;
  selDist.disabled = true;
  inputBusq.value    = '';
  filtroBusqueda     = '';
  filtroAcreditacion = 'todos';
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
  document.querySelector('.tab-btn[data-filtro="todos"]').classList.add('tab-btn--active');
  aplicarFiltros();
});

// ── APLICAR FILTROS ──
function aplicarFiltros() {
  const dep  = selDep.value;
  const prov = selProv.value;
  const dist = selDist.value;

  let resultado = todosLosLabs;

  // Filtro ubicación
  if (dep)  resultado = resultado.filter(l => l.departamento === dep);
  if (prov) resultado = resultado.filter(l => l.provincia    === prov);
  if (dist) resultado = resultado.filter(l => l.distrito     === dist);

  // Filtro búsqueda unificada: nombre de empresa + código + descripción de método
  if (filtroBusqueda) {
    resultado = resultado.filter(l => {
      // buscar en nombre del laboratorio
      const nombreMatch = (l.nombre || '').toLowerCase().includes(filtroBusqueda);
      // buscar en métodos acreditados (código + descripción)
      const metodos = l.metodos_acreditados || [];
      const metodoMatch = metodos.some(m => {
        const texto = `${m.codigo || ''} ${m.descripcion || ''}`.toLowerCase();
        return texto.includes(filtroBusqueda);
      });
      return nombreMatch || metodoMatch;
    });
  }

  // Filtro estado de acreditación
  // Soporta tanto el campo nuevo "estado" (string) como el legacy booleano "acreditado"
  if (filtroAcreditacion !== 'todos') {
    resultado = resultado.filter(l => {
      const estado = obtenerEstado(l);
      return estado === filtroAcreditacion;
    });
  }

  renderCards(resultado);
}

// ── OBTENER ESTADO NORMALIZADO ──
// Compatibilidad: si existe l.estado lo usa; si no, cae al booleano l.acreditado
function obtenerEstado(lab) {
  if (lab.estado) return lab.estado; // 'acreditado' | 'no_acreditado' | 'suspendido' | 'en_proceso'
  if (lab.acreditado === true)  return 'acreditado';
  if (lab.acreditado === false) return 'no_acreditado';
  return 'no_acreditado';
}

// ── CONFIG DE BADGES ──
const ESTADO_CONFIG = {
  acreditado:    { label: '✓ ACREDITADO',    cls: 'lab-badge-acreditado'    },
  no_acreditado: { label: '✗ NO ACREDITADO', cls: 'lab-badge-no-acreditado' },
  suspendido:    { label: '⏸ SUSPENDIDO',    cls: 'lab-badge-suspendido'    },
  en_proceso:    { label: '⏳ EN PROCESO',    cls: 'lab-badge-en-proceso'    },
};

// ── RENDER CARDS ──
function renderCards(labs) {
  listaLabs.innerHTML = '';
  resHeader.classList.remove('hidden');
  resCount.textContent = `${labs.length} laboratorio${labs.length !== 1 ? 's' : ''} encontrado${labs.length !== 1 ? 's' : ''}`;

  if (labs.length === 0) {
    vacio.classList.remove('hidden');
    return;
  }
  vacio.classList.add('hidden');
  labs.forEach((lab, i) => listaLabs.appendChild(crearCard(lab, i)));
}

// ── CREAR CARD ──
function crearCard(lab, idx) {
  const metodos = lab.metodos_acreditados || [];
  const count   = metodos.length;

  const btnLabel = count === 0
    ? 'Sin métodos registrados'
    : `${count} método${count !== 1 ? 's' : ''} acreditado${count !== 1 ? 's' : ''}`;

  const filasHtml = metodos.map(m => {
    const codigo = m.codigo || '';
    const desc   = m.descripcion || '';
    // highlight si el texto buscado coincide con código, descripción o nombre
    const hl = filtroBusqueda && `${codigo} ${desc}`.toLowerCase().includes(filtroBusqueda);
    return `
      <tr class="${hl ? 'metodo-row--highlight' : ''}">
        <td class="metodo-codigo">${codigo}</td>
        <td class="metodo-desc">${desc}</td>
      </tr>`;
  }).join('');

  // Badge según estado
  const estado = obtenerEstado(lab);
  const cfg    = ESTADO_CONFIG[estado] || ESTADO_CONFIG['no_acreditado'];
  const badgeHtml = `<span class="${cfg.cls}">${cfg.label}</span>`;

  const card = document.createElement('div');
  card.className = 'lab-card';
  card.style.animationDelay = `${idx * 40}ms`;

  card.innerHTML = `
    <div class="lab-card-header">
      <div class="lab-card-icon">
        ${lab.logo_url
          ? `<img src="${lab.logo_url}" alt="${lab.nombre}" />`
          : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4
                      M9 3v18m0 0h10a2 2 0 0 0 2-2v-4
                      M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
            </svg>`
        }
      </div>
      <div class="lab-card-info">

        <div class="lab-card-name">
          ${lab.website
            ? `<a href="${lab.website}" target="_blank" rel="noopener noreferrer"
                  style="color:inherit; text-decoration:none; cursor:pointer;"
                  onmouseover="this.style.opacity='0.7'"
                  onmouseout="this.style.opacity='1'"
                  title="Visitar sitio web">${lab.nombre}</a>`
            : lab.nombre
          }
        </div>
        <div class="lab-card-location">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${[lab.distrito, lab.provincia, lab.departamento].filter(Boolean).join(', ')}
        </div>
        ${lab.direccion ? `<div class="lab-card-location" style="margin-top:2px">${lab.direccion}</div>` : ''}
      </div>
      ${badgeHtml}
    </div>

    <div class="lab-card-body">
      <button type="button" class="btn-metodos ${count === 0 ? 'btn-metodos--empty' : ''}">
        <span class="btn-metodos-label">
          <svg class="btn-metodos-icon" width="13" height="13" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10
                     a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
            <rect x="9" y="3" width="6" height="4" rx="1"/>
            <line x1="9" y1="12" x2="15" y2="12"/>
            <line x1="9" y1="16" x2="13" y2="16"/>
          </svg>
          ${btnLabel}
        </span>
        ${count > 0 ? `
        <svg class="btn-metodos-chevron" width="14" height="14" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"/>
        </svg>` : ''}
      </button>

      ${count > 0 ? `
      <div class="metodos-panel">
        <table class="metodos-tabla">
          <tbody>
            ${filasHtml}
          </tbody>
        </table>
      </div>` : ''}
    </div>

    ${lab.geslasoft_activo ? `
    <div class="lab-card-footer">
      <button type="button" class="btn-cotizar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Solicitar cotización
      </button>
    </div>` : ''}
  `;

  // ── TOGGLE COLAPSABLE ──
  const btnMetodos = card.querySelector('.btn-metodos');
  const panel      = card.querySelector('.metodos-panel');
  if (btnMetodos && panel) {
    btnMetodos.addEventListener('click', () => {
      const abierto = panel.classList.toggle('metodos-panel--open');
      btnMetodos.classList.toggle('btn-metodos--open', abierto);
    });
  }

  // ── GUARDAR LAB EN localStorage AL HACER CLIC ──
  card.querySelector('.btn-cotizar')?.addEventListener('click', () => {
    localStorage.setItem('geslasoft_lab', JSON.stringify({
      id:              lab.id,
      organizacion_id: lab.organizacion_id,
      codigo:          lab.codigo, 
      nombre:          lab.nombre,
      ubicacion:       [lab.distrito, lab.provincia].filter(Boolean).join(', '),
      logo_url:        lab.logo_url || null,
      telefono:        lab.telefono        || null,
      email_contacto:  lab.email_contacto  || null,
      nombre_alternativo:  lab.nombre_alternativo  || null,
    }));
    window.location.href = 'formulario.html';
  });

  return card;
}

// ── HELPERS ──
function resetSelect(sel, placeholder) {
  sel.innerHTML = `<option value="">${placeholder}</option>`;
}

function mostrarCargando(show) {
  cargando.style.display = show ? 'flex' : 'none';
}

// ── ARRANCAR ──
init();