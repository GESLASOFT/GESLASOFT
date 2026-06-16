// ── CONFIGURACIÓN SUPABASE ──
const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';

// ── ESTADO ──
let todosLosLabs = [];
let marcadores   = [];
let mapa         = null;
let filtroTexto  = '';
let filtroAcred  = 'todos';

// ── DOM ──
const inputFiltro = document.getElementById('mapaFiltro');
const mapaCount   = document.getElementById('mapaCount');
const mapaCountTx = document.getElementById('mapaCountText');
const panelDet    = document.getElementById('panelDetalle');
const panelCont   = document.getElementById('panelContenido');
const btnCerrar   = document.getElementById('btnCerrarPanel');

// ── FETCH ──
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
  iniciarMapa();
  try {
    todosLosLabs = await fetchLabs();
    renderMarcadores(todosLosLabs);
  } catch (e) {
    console.error('Error al cargar laboratorios:', e);
  }
}

// ── INICIAR MAPA ──
function iniciarMapa() {
  mapa = L.map('mapa', {
    center: [-9.19, -75.0],   // centro del Perú
    zoom: 6,
    zoomControl: true,
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(mapa);
}

// ── CREAR ÍCONO PERSONALIZADO ──
function crearIcono(acreditado) {
  const color = acreditado ? '#00897B' : '#9CA3AF';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
      <path d="M16 0C7.16 0 0 7.16 0 16c0 10.5 16 26 16 26S32 26.5 32 16C32 7.16 24.84 0 16 0z"
            fill="${color}" stroke="white" stroke-width="2"/>
      <circle cx="16" cy="16" r="6" fill="white"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize:   [32, 42],
    iconAnchor: [16, 42],
    popupAnchor:[0, -44],
  });
}

// ── RENDER MARCADORES ──
function renderMarcadores(labs) {
  // Limpiar marcadores anteriores
  marcadores.forEach(m => mapa.removeLayer(m));
  marcadores = [];

  const conCoordenadas = labs.filter(l => l.latitud && l.longitud);

  conCoordenadas.forEach(lab => {
    const icono   = crearIcono(lab.acreditado);
    const marcador = L.marker([lab.latitud, lab.longitud], { icon: icono });

    // Popup rápido
    const popupHtml = `
      <div class="popup-nombre">${lab.nombre}</div>
      <div class="popup-loc">${[lab.distrito, lab.provincia, lab.departamento].filter(Boolean).join(', ')}</div>
      <button class="popup-ver" onclick="abrirPanel(${lab.id})">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        Ver detalle
      </button>`;

    marcador.bindPopup(popupHtml, { maxWidth: 220 });
    marcador.addTo(mapa);
    marcador._labId = lab.id;
    marcadores.push(marcador);
  });

  // Contador
  mapaCount.classList.remove('hidden');
  mapaCountTx.textContent = `${conCoordenadas.length} laboratorio${conCoordenadas.length !== 1 ? 's' : ''} en el mapa`;

  // Ajustar vista si hay marcadores
  if (conCoordenadas.length > 0) {
    const grupo = L.featureGroup(marcadores);
    mapa.fitBounds(grupo.getBounds().pad(0.2));
  }
}

// ── ABRIR PANEL DE DETALLE ──
window.abrirPanel = function(id) {
  const lab     = todosLosLabs.find(l => l.id === id);
  if (!lab) return;

  const metodos = lab.metodos_acreditados || [];
  const count   = metodos.length;

  const filasHtml = metodos.map(m => `
    <tr>
      <td class="panel-metodo-codigo">${m.codigo || ''}</td>
      <td class="panel-metodo-desc">${m.descripcion || ''}</td>
    </tr>`).join('');

  const btnLabel = count === 0
    ? 'Sin métodos registrados'
    : `${count} método${count !== 1 ? 's' : ''} acreditado${count !== 1 ? 's' : ''}`;

  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lab.latitud},${lab.longitud}`;
  const wazeUrl  = `https://waze.com/ul?ll=${lab.latitud},${lab.longitud}&navigate=yes`;

  panelCont.innerHTML = `
    <div class="panel-nombre">${lab.nombre}</div>
    <div class="panel-ubicacion">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      ${[lab.distrito, lab.provincia, lab.departamento].filter(Boolean).join(', ')}
      ${lab.direccion ? `<br><span style="margin-left:15px">${lab.direccion}</span>` : ''}
    </div>

    <div class="panel-badges">
      ${lab.acreditado
        ? '<span class="lab-badge-acreditado">✓ ACREDITADO</span>'
        : '<span class="lab-badge-no-acreditado">✗ NO ACREDITADO</span>'}
    </div>

    <!-- Métodos colapsable -->
    <button type="button" class="panel-metodos-btn ${count === 0 ? 'panel-metodos-btn--empty' : ''}" id="panelBtnMet">
      <span class="panel-metodos-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
          <rect x="9" y="3" width="6" height="4" rx="1"/>
          <line x1="9" y1="12" x2="15" y2="12"/>
          <line x1="9" y1="16" x2="13" y2="16"/>
        </svg>
        ${btnLabel}
      </span>
      ${count > 0 ? `
      <svg class="panel-metodos-chevron" width="14" height="14" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>` : ''}
    </button>

    ${count > 0 ? `
    <div class="panel-metodos-panel" id="panelMetPanel">
      <table class="panel-metodos-tabla">
        <tbody>${filasHtml}</tbody>
      </table>
    </div>` : ''}

    <!-- Botones de navegación -->
    <div class="panel-acciones">
      <a href="${gmapsUrl}" target="_blank" class="btn-llegar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
        Cómo llegar — Google Maps
      </a>
      <a href="${wazeUrl}" target="_blank" class="btn-llegar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
        Cómo llegar — Waze
      </a>
      ${lab.geslasoft_activo ? `
      <button type="button" class="btn-cotizar" onclick="irFormulario(${lab.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"/>
          <polygon points="22 2 15 22 11 13 2 9 22 2"/>
        </svg>
        Solicitar cotización
      </button>` : ''}
    </div>
  `;

  panelDet.classList.remove('hidden');

  // Toggle métodos
  const btnMet  = document.getElementById('panelBtnMet');
  const metPanel = document.getElementById('panelMetPanel');
  if (btnMet && metPanel) {
    btnMet.addEventListener('click', () => {
      const abierto = metPanel.classList.toggle('panel-metodos-panel--open');
      btnMet.classList.toggle('panel-metodos-btn--open', abierto);
    });
  }

  // Centrar mapa en el lab
  if (lab.latitud && lab.longitud) {
    mapa.setView([lab.latitud, lab.longitud], 14);
  }
};

// ── IR A FORMULARIO ──
window.irFormulario = function(id) {
  const lab = todosLosLabs.find(l => l.id === id);
  if (!lab) return;
  localStorage.setItem('geslasoft_lab', JSON.stringify({
    id:              lab.id,
    organizacion_id: lab.organizacion_id,
    nombre:          lab.nombre,
    ubicacion:       [lab.distrito, lab.provincia].filter(Boolean).join(', '),
  }));
  window.location.href = 'formulario.html';
};

// ── CERRAR PANEL ──
btnCerrar.addEventListener('click', () => {
  panelDet.classList.add('hidden');
});

// ── FILTROS ──
let filtroTimer;
inputFiltro.addEventListener('input', () => {
  clearTimeout(filtroTimer);
  filtroTimer = setTimeout(() => {
    filtroTexto = inputFiltro.value.trim().toLowerCase();
    aplicarFiltros();
  }, 300);
});

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
    btn.classList.add('tab-btn--active');
    filtroAcred = btn.dataset.filtro;
    aplicarFiltros();
  });
});

function aplicarFiltros() {
  let resultado = todosLosLabs;

  if (filtroTexto) {
    resultado = resultado.filter(l => {
      const nombre = l.nombre.toLowerCase();
      const metodos = (l.metodos_acreditados || []).some(m =>
        `${m.codigo || ''} ${m.descripcion || ''}`.toLowerCase().includes(filtroTexto)
      );
      return nombre.includes(filtroTexto) || metodos;
    });
  }

  if (filtroAcred === 'acreditados')    resultado = resultado.filter(l => l.acreditado === true);
  if (filtroAcred === 'no_acreditados') resultado = resultado.filter(l => l.acreditado === false);

  renderMarcadores(resultado);
  panelDet.classList.add('hidden');
}

// ── ARRANCAR ──
init();