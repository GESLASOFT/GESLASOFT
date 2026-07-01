/* ══════════════════════════════════════════
   REQUERIMIENTO.JS
   Lógica de pages/requerimiento.html
   ══════════════════════════════════════════ */

const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';

// ── ESTADO LOCAL ──
let todasLasSolicitudes = [];

// ── TOAST ──
let toastTimer;
function mostrarToast(msg) {
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// ── FORMATO DE FECHA ──
function formatearFecha(isoStr) {
  if (!isoStr) return { dia: '—', hora: '' };
  const d = new Date(isoStr);
  const dia  = d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
  const hora = d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  return { dia, hora };
}

// ── CARGAR ÍTEMS DE UNA SOLICITUD ──
async function cargarItems(solicitudId) {
  const token = sessionStorage.getItem('geslasoft_token');
  const url   = `${SUPABASE_URL}/rest/v1/solicitud_items`
    + `?solicitud_id=eq.${solicitudId}`
    + `&order=area_disciplina.asc,ensayo_nombre.asc`;

  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${token}`,
    }
  });
  if (!res.ok) throw new Error(`Error al cargar ensayos (${res.status})`);
  return res.json();
}

// ── RENDER PANEL DE ENSAYOS ──
function renderEnsayos(items, contenedor) {
  if (!items || items.length === 0) {
    contenedor.innerHTML = `<span class="detalle-valor--vacio">Sin ensayos registrados</span>`;
    return;
  }

  // Agrupar por disciplina
  const grupos = {};
  items.forEach(it => {
    const disc = it.area_disciplina || 'General';
    if (!grupos[disc]) grupos[disc] = [];
    grupos[disc].push(it);
  });

  const wrap = document.createElement('div');
  wrap.className = 'detalle-ensayos';

  Object.entries(grupos).forEach(([disc, ensayos]) => {
    const grupDiv = document.createElement('div');
    grupDiv.innerHTML = `<span class="detalle-disciplina-label">${disc}</span>`;

    ensayos.forEach(it => {
      const row = document.createElement('div');
      row.className = 'detalle-ensayo-row';
      row.innerHTML = `
        <span class="detalle-ensayo-nombre">${it.ensayo_nombre}</span>
        <span class="detalle-ensayo-norma">${it.norma || ''}</span>
        <span class="detalle-ensayo-cant">× ${it.cantidad}</span>
        ${it.observacion ? `<span class="detalle-ensayo-obs">Obs: ${it.observacion}</span>` : ''}
      `;
      grupDiv.appendChild(row);
    });

    wrap.appendChild(grupDiv);
  });

  contenedor.innerHTML = '';
  contenedor.appendChild(wrap);
}

// ── VALOR O VACÍO ──
function val(v) {
  return v
    ? `<span class="detalle-valor">${v}</span>`
    : `<span class="detalle-valor detalle-valor--vacio">—</span>`;
}

// ── RENDER DE UN CARD ──
function crearCard(sol) {
  const estado  = (sol.estado || 'pendiente').toLowerCase();
  const { dia, hora } = formatearFecha(sol.creado_en);

  const nro      = sol.nro_solicitud || (sol.correlativo ? `#${sol.correlativo}` : sol.id.slice(0, 8).toUpperCase());
  const solicit  = sol.nombre_solicitante || '—';
  const empresa  = sol.empresa_solicitante || '';
  const proyecto = sol.nombre_proyecto || '';
  const origen   = sol.origen || '';

  const badgeLabel = {
    pendiente: 'Pendiente',
    aprobado:  'Aprobado',
    rechazado: 'Rechazado',
  }[estado] || estado;

  const { dia: aprobDia } = formatearFecha(sol.aprobado_en);
  const tieneCotizacion = sol.cotizaciones && sol.cotizaciones.length > 0;
  const botonCotizarHtml = tieneCotizacion
    ? `<span class="sol-badge-atendido">Atendido</span>`
    : `<a href="../panel_lab/preparar_cotizacion.html?solicitud_id=${sol.id}" class="btn-cotizar">Cotizar</a>`;


  const card = document.createElement('div');
  card.className = 'sol-card';
  card.innerHTML = `
    <div class="sol-card-main">
      <div class="sol-card-accent sol-card-accent--${estado}"></div>
      <div class="sol-card-body">
        <div class="sol-card-top">
          <span class="sol-nro">${nro}</span>
          <span class="sol-badge sol-badge--${estado}">${badgeLabel}</span>
        </div>
        <div class="sol-card-mid">
          <span class="sol-solicitante">${solicit}</span>
          ${empresa ? `<span class="sol-sep">·</span><span class="sol-empresa">${empresa}</span>` : ''}
        </div>
        ${proyecto ? `<div class="sol-proyecto">${proyecto}</div>` : ''}
      </div>



      <div class="sol-card-meta">
        ${origen ? `<span class="sol-origen-badge">${origen}</span>` : ''}
        <div class="sol-fecha">
          <span class="sol-fecha-dia">${dia}</span>
          <span class="sol-fecha-hora">${hora}</span>
        </div>
        ${botonCotizarHtml}
        <button class="btn-detalle" data-id="${sol.id}">
          Ver
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2.5"
              stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>
      </div>

    </div>

    <!-- PANEL EXPANDIBLE -->
    <div class="sol-card-detalle" id="detalle-${sol.id}">

      <!-- CLIENTE -->
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Cliente</div>
        <div class="detalle-grid">
          <span class="detalle-label">Empresa :</span>
          ${val(sol.empresa_solicitante)}
          <span class="detalle-label">${sol.ruc_dni && sol.ruc_dni.length === 11 ? 'RUC :' : sol.ruc_dni && sol.ruc_dni.length === 8 ? 'DNI :' : 'RUC / DNI :'}</span>
          ${val(sol.ruc_dni)}
          <span class="detalle-label">Dirección :</span>
          ${val(sol.direccion)}
        </div>
      </div>

      <!-- SOLICITANTE -->
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Solicitante</div>
        <div class="detalle-grid">
          <span class="detalle-label">Nombre :</span>
          ${val(sol.nombre_solicitante)}
          <span class="detalle-label">Cargo :</span>
          ${val(sol.cargo_solicitante)}
          <span class="detalle-label">Teléfono :</span>
          ${val(sol.telefono)}
          <span class="detalle-label">Email :</span>
          ${val(sol.email)}
        </div>
      </div>

      <!-- PROYECTO -->
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Proyecto</div>
        <div class="detalle-grid">
          <span class="detalle-label">Nombre :</span>
          ${val(sol.nombre_proyecto)}
          <span class="detalle-label">Descripción :</span>
          ${val(sol.ubicacion)}
        </div>
      </div>

      <!-- ENSAYOS -->
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Ensayos solicitados</div>
        <div class="detalle-items-loading" id="items-loading-${sol.id}">
          <div class="mini-spinner"></div>
          <span>Cargando ensayos...</span>
        </div>
        <div id="items-contenedor-${sol.id}"></div>
      </div>

      <!-- OBSERVACIONES -->
      ${sol.observaciones ? `
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Observaciones</div>
        <span class="detalle-valor">${sol.observaciones}</span>
      </div>` : ''}

      ${sol.motivo_rechazo ? `
      <div class="detalle-seccion">
        <div class="detalle-seccion-titulo">Motivo de rechazo</div>
        <span class="detalle-valor" style="color:var(--danger)">${sol.motivo_rechazo}</span>
      </div>` : ''}

      <!-- PIE -->
      <div class="detalle-footer">
        <span class="detalle-footer-item">Registrado por: <strong>${
          sol.origen === 'portal_publico'  ? 'Cliente externo' :
          sol.origen === 'portal_cliente'  ? `${sol.usuarios?.nombre_completo || '—'} (cliente)` :
                                             `${sol.usuarios?.nombre_completo || '—'} (personal interno)`
        }</strong></span>
        <span class="detalle-footer-item">Fecha de registro: <strong>${dia} ${hora}</strong></span>
      </div>

    </div>
  `;

  // ── LÓGICA DEL BOTÓN VER / CERRAR ──
  const btnDetalle   = card.querySelector('.btn-detalle');
  const panelDetalle = card.querySelector('.sol-card-detalle');
  const loadingEl    = card.querySelector(`#items-loading-${sol.id}`);
  const contenedorEl = card.querySelector(`#items-contenedor-${sol.id}`);
  let itemsCargados  = false;

  btnDetalle.addEventListener('click', async () => {
    const abierto = panelDetalle.classList.toggle('visible');
    btnDetalle.classList.toggle('abierto', abierto);
    btnDetalle.querySelector('span') && (btnDetalle.childNodes[0].textContent = abierto ? 'Cerrar' : 'Ver');

    // Cambiar texto del botón
    btnDetalle.childNodes[0].nodeValue = abierto ? 'Cerrar ' : 'Ver ';

    if (abierto && !itemsCargados) {
      try {
        const items = await cargarItems(sol.id);
        itemsCargados = true;
        loadingEl.style.display = 'none';
        renderEnsayos(items, contenedorEl);
      } catch (err) {
        loadingEl.innerHTML = `<span style="color:var(--danger)">Error al cargar ensayos</span>`;
      }
    }
  });

  return card;
}

// ── RENDER LISTA (con filtros aplicados) ──
function renderLista(solicitudes) {
  const lista    = document.getElementById('solicitudesLista');
  const empty    = document.getElementById('estadoVacio');
  const countEl  = document.getElementById('filtrosCount');

  lista.innerHTML = '';

  if (solicitudes.length === 0) {
    empty.style.display  = 'flex';
    lista.style.display  = 'none';
    countEl.textContent  = '0 solicitudes';
    return;
  }

  empty.style.display  = 'none';
  lista.style.display  = 'flex';
  countEl.textContent  = `${solicitudes.length} solicitud${solicitudes.length !== 1 ? 'es' : ''}`;

  solicitudes.forEach(sol => lista.appendChild(crearCard(sol)));
}

// ── APLICAR FILTROS ──
function aplicarFiltros() {
  const busqueda = document.getElementById('filtroBusqueda').value.trim().toLowerCase();
  const estado   = document.getElementById('filtroEstado').value;
  const anio     = document.getElementById('filtroAnio').value;

  let resultado = todasLasSolicitudes;

  if (busqueda) {
    resultado = resultado.filter(s =>
      (s.nombre_solicitante || '').toLowerCase().includes(busqueda) ||
      (s.empresa_solicitante || '').toLowerCase().includes(busqueda) ||
      (s.nro_solicitud || '').toLowerCase().includes(busqueda)
    );
  }

  if (estado) {
    resultado = resultado.filter(s => (s.estado || '').toLowerCase() === estado);
  }

  if (anio) {
    resultado = resultado.filter(s => String(s.anio) === anio || new Date(s.creado_en).getFullYear() === Number(anio));
  }

  renderLista(resultado);
}

// ── POBLAR DROPDOWN DE AÑOS ──
function poblarAnios() {
  const anios = [...new Set(
    todasLasSolicitudes.map(s => s.anio || new Date(s.creado_en).getFullYear()).filter(Boolean)
  )].sort((a, b) => b - a);

  const sel = document.getElementById('filtroAnio');
  anios.forEach(a => {
    const opt = document.createElement('option');
    opt.value       = a;
    opt.textContent = a;
    sel.appendChild(opt);
  });
}

// ── CARGAR SOLICITUDES ──
async function cargarSolicitudes(token, organizacionId) {
  const url = `${SUPABASE_URL}/rest/v1/solicitudes`
    + `?organizacion_id=eq.${organizacionId}`
    + `&select=*,usuarios(nombre_completo),cotizaciones(id,nro_cotizacion,estado,version)`
    + `&order=creado_en.desc`;

  const res = await fetch(url, {
    headers: {
      'apikey':        SUPABASE_ANON,
      'Authorization': `Bearer ${token}`,
    }
  });

  if (!res.ok) throw new Error(`Error al cargar solicitudes (${res.status})`);
  return res.json();
}

// ── INIT ──
async function init() {
  const token      = sessionStorage.getItem('geslasoft_token');
  const usuarioStr = sessionStorage.getItem('geslasoft_usuario');

  if (!token || !usuarioStr) {
    window.location.href = 'login.html';
    return;
  }

  const usuario = JSON.parse(usuarioStr);

  // Poblar header usuario
  const nombreCorto = usuario.nombre_corto || usuario.nombre_completo?.split(' ')[0] || '—';
  document.getElementById('usuarioNombre').textContent = nombreCorto;
  document.getElementById('usuarioRol').textContent    = usuario.roles?.nombre || '—';
  document.getElementById('usuarioAvatar').textContent = (usuario.nombre_completo || '?')[0].toUpperCase();

  try {
    const solicitudes = await cargarSolicitudes(token, usuario.organizacion_id);
    todasLasSolicitudes = solicitudes;

    poblarAnios();
    renderLista(todasLasSolicitudes);

    // Ocultar loading, mostrar contenido
    document.getElementById('estadoCargando').style.display = 'none';
    document.getElementById('reqContenido').style.display   = 'flex';

  } catch (err) {
    console.error(err);
    document.getElementById('estadoCargando').innerHTML =
      `<p style="color:var(--danger); text-align:center">Error al cargar solicitudes.<br><small>${err.message}</small></p>`;
  }
}

// ── EVENTOS FILTROS ──
document.getElementById('filtroBusqueda').addEventListener('input',  aplicarFiltros);
document.getElementById('filtroEstado').addEventListener('change',   aplicarFiltros);
document.getElementById('filtroAnio').addEventListener('change',     aplicarFiltros);

// ── ARRANCAR ──
init();