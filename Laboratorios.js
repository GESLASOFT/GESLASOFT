// ── CONFIGURACIÓN SUPABASE ──
const SUPABASE_URL    = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON   = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';

// ── ESTADO ──
let todosLosLabs = [];
let filtroMetodo = '';

// ── DOM ──
const selDep     = document.getElementById('filDepartamento');
const selProv    = document.getElementById('filProvincia');
const selDist    = document.getElementById('filDistrito');
const inputMet   = document.getElementById('filMetodo');
const btnLimpiar = document.getElementById('btnLimpiar');
const listaLabs  = document.getElementById('listaLabs');
const cargando   = document.getElementById('estadoCargando');
const vacio      = document.getElementById('estadoVacio');
const resHeader  = document.getElementById('resultadosHeader');
const resCount   = document.getElementById('resultadosCount');

// ── FETCH SUPABASE ──
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
  console.log('Labs:', data); // para verificar
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
  const deps = [...new Set(todosLosLabs.map(l => l.departamento))].sort();
  deps.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d; opt.textContent = d;
    selDep.appendChild(opt);
  });
}

// ── CASCADA: DEP → PROV ──
selDep.addEventListener('change', () => {
  const dep = selDep.value;

  // Reset provincia y distrito
  resetSelect(selProv, 'Todas las provincias');
  resetSelect(selDist, 'Todos los distritos');
  selDist.disabled = true;

  if (!dep) {
    selProv.disabled = true;
  } else {
    const provs = [...new Set(
      todosLosLabs
        .filter(l => l.departamento === dep)
        .map(l => l.provincia)
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

// ── FILTRO MÉTODO (debounce) ──
let metodoTimer;
inputMet.addEventListener('input', () => {
  clearTimeout(metodoTimer);
  metodoTimer = setTimeout(() => {
    filtroMetodo = inputMet.value.trim().toLowerCase();
    aplicarFiltros();
  }, 300);
});

// ── LIMPIAR ──
btnLimpiar.addEventListener('click', () => {
  selDep.value   = '';
  resetSelect(selProv, 'Todas las provincias');
  resetSelect(selDist, 'Todos los distritos');
  selProv.disabled = true;
  selDist.disabled = true;
  inputMet.value   = '';
  filtroMetodo     = '';
  aplicarFiltros();
});

// ── APLICAR FILTROS ──
function aplicarFiltros() {
  const dep  = selDep.value;
  const prov = selProv.value;
  const dist = selDist.value;

  let resultado = todosLosLabs;

  if (dep)  resultado = resultado.filter(l => l.departamento === dep);
  if (prov) resultado = resultado.filter(l => l.provincia    === prov);
  if (dist) resultado = resultado.filter(l => l.distrito     === dist);

  if (filtroMetodo) {
    resultado = resultado.filter(l => {
      const metodos = l.metodos_acreditados || [];
      return metodos.some(m => m.toLowerCase().includes(filtroMetodo));
    });
  }

  renderCards(resultado);
}

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

  labs.forEach((lab, i) => {
    const card = crearCard(lab, i);
    listaLabs.appendChild(card);
  });
}

// ── CREAR CARD ──
function crearCard(lab, idx) {
  const metodos = lab.metodos_acreditados || [];

  // Determinar qué chips destacar (coinciden con filtro de método)
  const metodosFiltro = filtroMetodo;

  const chipsHtml = metodos.length > 0
    ? metodos.map(m => {
        const highlight = metodosFiltro && m.toLowerCase().includes(metodosFiltro);
        return `<span class="chip ${highlight ? 'chip--highlight' : ''}">${m}</span>`;
      }).join('')
    : `<span class="chip chip--empty">Sin métodos registrados</span>`;

  const card = document.createElement('div');
  card.className = 'lab-card';
  card.style.animationDelay = `${idx * 40}ms`;

  card.innerHTML = `
    <div class="lab-card-header">
      <div class="lab-card-icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4
                   M9 3v18m0 0h10a2 2 0 0 0 2-2v-4
                   M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/>
        </svg>
      </div>
      <div class="lab-card-info">
        <div class="lab-card-name">${lab.nombre}</div>
        <div class="lab-card-location">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
          ${lab.distrito}, ${lab.provincia}, ${lab.departamento}
        </div>
        ${lab.direccion ? `<div class="lab-card-location" style="margin-top:2px">${lab.direccion}</div>` : ''}
      </div>
      ${lab.acreditado ? '<span class="lab-badge-acreditado">✓ ACREDITADO</span>' : ''}
    </div>

    ${metodos.length > 0 ? `
    <div class="lab-card-body">
      <div>
        <div class="lab-metodos-label">Métodos acreditados</div>
        <div class="lab-metodos-chips">${chipsHtml}</div>
      </div>
    </div>` : `
    <div class="lab-card-body">
      <div class="lab-metodos-chips">${chipsHtml}</div>
    </div>`}

    <div class="lab-card-footer">
      <a href="formulario.html" class="btn-cotizar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Solicitar cotización
      </a>
    </div>
  `;

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