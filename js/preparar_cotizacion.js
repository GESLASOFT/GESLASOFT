/* ══════════════════════════════════════════
   PREPARAR_COTIZACION.JS
   Lógica de pages/panel_lab/preparar_cotizacion.html
   ══════════════════════════════════════════ */

const SUPABASE_URL  = 'https://aahisaouszyvcqhgzssx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaGlzYW91c3p5dmNxaGd6c3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4Njg3NjgsImV4cCI6MjA5MjQ0NDc2OH0.6oJ9SSIX8C7DkFmhgZ3p-YZYHYu-eF9S3wlzAqmKFqY';

// ── ESTADO LOCAL ──
let solicitud   = null;
let items       = [];
let moneda      = 'USD';
let tipoCambio  = 3.75;
let preciosUsdBase = []; // precio en USD por ítem — fuente de verdad, independiente de la moneda mostrada
let preciosAcreditados = []; // true/false por ítem — si el método está acreditado para ese laboratorio

// ── DOM ──
const estadoCargando = document.getElementById('estadoCargando');
const estadoError    = document.getElementById('estadoError');
const errorMsg       = document.getElementById('errorMsg');
const cotContenido   = document.getElementById('cotContenido');
const headerSub      = document.getElementById('headerSub');
const ensayosContainer = document.getElementById('ensayosContainer');
const btnUSD         = document.getElementById('btnUSD');
const btnPEN         = document.getElementById('btnPEN');
const campoTipoCambio= document.getElementById('campoTipoCambio');
const tipoCambioInput= document.getElementById('tipoCambio');
const totalSubtotal  = document.getElementById('totalSubtotal');
const totalIgv       = document.getElementById('totalIgv');
const totalFinal     = document.getElementById('totalFinal');
const elaboradoInput = document.getElementById('elaboradoPor');
const notasInput     = document.getElementById('notas');
const btnEnviar      = document.getElementById('btnEnviar');

// ── HEADERS COMUNES ──
function authHeaders(token) {
  return {
    'apikey':        SUPABASE_ANON,
    'Authorization': `Bearer ${token}`,
    'Content-Type':  'application/json',
  };
}



function normalizarCodigo(c) {
  return (c || '').trim().toUpperCase().replace(/\s+/g, ' ');
}


async function cargarPreciosLaboratorio(token, laboratorioId) {
  if (!laboratorioId) return { precios: {}, acreditados: {} };
  const url = `${SUPABASE_URL}/rest/v1/laboratorio_metodos`
    + `?laboratorio_id=eq.${laboratorioId}`
    + `&select=id,metodo_id,acreditado,metodos(codigo,codigo_ntp,codigo_iso,codigo_aashto),laboratorio_metodo_precios(precio_usd,anio)`;
  try {
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) return { precios: {}, acreditados: {} };
    const data = await res.json();
    const precios = {};
    const acreditados = {};
    data.forEach(row => {
      const precioRow = (row.laboratorio_metodo_precios || [])
        .sort((a, b) => b.anio - a.anio)[0];
      if (!precioRow) return;
      const codigos = [
        row.metodos?.codigo,
        row.metodos?.codigo_ntp,
        row.metodos?.codigo_iso,
        row.metodos?.codigo_aashto,
      ].filter(Boolean);
      codigos.forEach(c => {
        const key = normalizarCodigo(c);
        precios[key] = precioRow.precio_usd;
        acreditados[key] = row.acreditado === true;
      });
    });
    return { precios, acreditados };
  } catch (e) {
    console.error('No se pudieron cargar precios automáticos:', e);
    return { precios: {}, acreditados: {} };
  }
}

function calcularValorMostrado(idx) {
  const usd = preciosUsdBase[idx];
  if (usd === null || usd === undefined) return null;
  return moneda === 'PEN' ? usd * tipoCambio : usd;
}

async function cargarTasaCambioSugerida(token, laboratorioId) {
  if (!laboratorioId) return null;
  try {
    // 1. Obtener la moneda local del laboratorio
    const urlLab = `${SUPABASE_URL}/rest/v1/laboratorios?id=eq.${laboratorioId}&select=moneda_local`;
    const resLab = await fetch(urlLab, { headers: authHeaders(token) });
    if (!resLab.ok) return null;
    const labData = await resLab.json();
    const monedaLocal = labData[0]?.moneda_local;
    if (!monedaLocal || monedaLocal === 'USD') return null;

    // 2. Buscar la tasa vigente para esa moneda
    const urlTasa = `${SUPABASE_URL}/rest/v1/tasas_cambio?moneda=eq.${monedaLocal}&select=tasa`;
    const resTasa = await fetch(urlTasa, { headers: authHeaders(token) });
    if (!resTasa.ok) return null;
    const tasaData = await resTasa.json();
    return tasaData[0]?.tasa || null;
  } catch (e) {
    console.error('No se pudo cargar la tasa de cambio sugerida:', e);
    return null;
  }
}

async function contarVersionesPrevias(token, solicitudId) {
  const url = `${SUPABASE_URL}/rest/v1/cotizaciones?solicitud_id=eq.${solicitudId}&select=id`;
  try {
    const res = await fetch(url, { headers: authHeaders(token) });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.length;
  } catch (e) {
    console.error('No se pudo contar versiones previas:', e);
    return 0;
  }
}

// ── TOAST ──
let toastTimer;
function mostrarToast(msg, tipo = 'accent') {
  const colores = {
    accent:  { bg: '#00897B', color: '#fff' },
    warning: { bg: '#F59E0B', color: '#fff' },
    danger:  { bg: '#EF4444', color: '#fff' },
  };
  const c = colores[tipo] || colores.accent;
  const toast = document.getElementById('toastMsg');
  toast.textContent = msg;
  toast.style.background = c.bg;
  toast.style.color = c.color;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2800);
}

// ── LEER solicitud_id DE LA URL ──
function obtenerSolicitudId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('solicitud_id');
}

// ── CARGAR SOLICITUD + ITEMS ──
async function cargarSolicitud(token, solicitudId) {
  const urlSol = `${SUPABASE_URL}/rest/v1/solicitudes`
    + `?id=eq.${solicitudId}&select=*`;
  const resSol = await fetch(urlSol, { headers: authHeaders(token) });
  if (!resSol.ok) throw new Error(`Error al cargar solicitud (${resSol.status})`);
  const solData = await resSol.json();
  if (!solData.length) throw new Error('Solicitud no encontrada');

  const urlItems = `${SUPABASE_URL}/rest/v1/solicitud_items`
    + `?solicitud_id=eq.${solicitudId}&order=area_disciplina.asc,ensayo_nombre.asc`;
  const resItems = await fetch(urlItems, { headers: authHeaders(token) });
  if (!resItems.ok) throw new Error(`Error al cargar ensayos (${resItems.status})`);
  const itemsData = await resItems.json();

  return { solicitud: solData[0], items: itemsData };
}

// ── RENDER INFO SOLICITUD ──
function renderInfoSolicitud() {
  document.getElementById('infoNroSolicitud').textContent = solicitud.nro_solicitud || '—';
  document.getElementById('infoCliente').textContent =
    solicitud.empresa_solicitante || solicitud.nombre_solicitante || '—';
  document.getElementById('infoSolicitante').textContent = solicitud.nombre_solicitante || '—';
  headerSub.textContent = solicitud.nro_solicitud || 'Solicitud';
}



// ── RENDER ENSAYOS ──
function renderEnsayos() {
  ensayosContainer.innerHTML = '';
  items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'ensayo-row';
    const valorMostrado = calcularValorMostrado(idx);
    row.innerHTML = `
      <div class="field">
        <label>Descripción</label>
        <input type="text" class="ensayo-desc" data-idx="${idx}" value="${item.ensayo_nombre}" />
      </div>
      <div class="ensayo-row-meta">
        <span class="ensayo-norma">${item.norma || ''}</span>
        <span class="ensayo-cantidad">× ${item.cantidad}</span>
      </div>
      <div class="ensayo-row-precio">
        <label>Precio unitario</label>
        <input type="number" class="ensayo-precio-input precio-input" data-idx="${idx}"
               step="0.01" min="0" placeholder="0.00"
               value="${valorMostrado !== null ? valorMostrado.toFixed(2) : ''}" />
      </div>
    `;
    ensayosContainer.appendChild(row);
  });

  // Eventos: al editar a mano, se recalcula y se guarda de vuelta en USD
  ensayosContainer.querySelectorAll('.precio-input').forEach(input => {
    input.addEventListener('input', (e) => {
      const idx = Number(e.target.dataset.idx);
      const val = parseFloat(e.target.value);
      preciosUsdBase[idx] = isNaN(val) ? null : (moneda === 'PEN' ? val / tipoCambio : val);
      calcularTotales();
    });
  });
}


// ── CALCULAR TOTALES ──
function calcularTotales() {
  let subtotal = 0;
  ensayosContainer.querySelectorAll('.precio-input').forEach((input, idx) => {
    const precio   = parseFloat(input.value) || 0;
    const cantidad = items[idx].cantidad || 1;
    subtotal += precio * cantidad;
  });
  const igv   = subtotal * 0.18;
  const total = subtotal + igv;
  const simbolo = moneda === 'USD' ? 'USD' : 'S/.';

  totalSubtotal.textContent = `${simbolo} ${subtotal.toFixed(2)}`;
  totalIgv.textContent      = `${simbolo} ${igv.toFixed(2)}`;
  totalFinal.textContent    = `${simbolo} ${total.toFixed(2)}`;
}

// ── TOGGLE MONEDA ──
function seleccionarMoneda(nuevaMoneda) {
  moneda = nuevaMoneda;
  btnUSD.classList.toggle('active', moneda === 'USD');
  btnPEN.classList.toggle('active', moneda === 'PEN');
  campoTipoCambio.classList.toggle('hidden', moneda !== 'PEN');
  renderEnsayos(); // repinta los precios convertidos a la nueva moneda
  calcularTotales();
}

btnUSD.addEventListener('click', () => seleccionarMoneda('USD'));
btnPEN.addEventListener('click', () => seleccionarMoneda('PEN'));
tipoCambioInput.addEventListener('input', () => {
  const tc = parseFloat(tipoCambioInput.value);
  if (tc > 0) {
    tipoCambio = tc;
    if (moneda === 'PEN') {
      renderEnsayos();
      calcularTotales();
    }
  }
});

// ── DATOS DEL FORMULARIO EN EDICIÓN (borrador) ──
function obtenerDatosFormulario() {
  const precios = [];
  const descripciones = [];
  ensayosContainer.querySelectorAll('.precio-input').forEach((input, idx) => {
    precios[idx] = parseFloat(input.value) || 0;
  });
  ensayosContainer.querySelectorAll('.ensayo-desc').forEach((input, idx) => {
    descripciones[idx] = input.value.trim() || items[idx].ensayo_nombre;
  });
  return { precios, descripciones };
}

function cargarImagenComoBase64(url) {
  return new Promise((resolve) => {
    if (!url) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// ── NÚCLEO DE GENERACIÓN DE PDF ──
// Recibe los datos ya resueltos (sea del borrador en edición o de una cotización guardada)
// y arma el documento. No sabe de dónde vinieron los datos.
async function renderPdfDesdeDatos({
  nroCotizacionMostrar,
  versionMostrar,
  monedaUsada,
  itemsArr,        // array con { ensayo_nombre/descripcion, norma, cantidad }
  precios,         // array de números, alineado con itemsArr
  descripciones,   // array de strings, alineado con itemsArr
  acreditadosArr,  // array de booleans, alineado con itemsArr
  notasTexto,
  elaboradoPorTexto,
}) {
  const usuarioSesion = JSON.parse(sessionStorage.getItem('geslasoft_usuario') || 'null');
  const lab = usuarioSesion?.laboratorios || null;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const azulOsc  = [0, 51, 102];
  const azulFila = [234, 243, 251];
  const grisClr  = [245, 248, 250];
  const gris400  = [170, 170, 170];
  const gris700  = [85, 85, 85];

  const marginX = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - marginX * 2;

  const subtotal = precios.reduce((sum, p, idx) => sum + p * (itemsArr[idx].cantidad || 1), 0);
  const igv = subtotal * 0.18;
  const total = subtotal + igv;
  const simbolo = monedaUsada === 'USD' ? 'USD' : 'S/.';

  let logoBase64 = null;
  if (lab?.logo_url && !lab.logo_url.startsWith('data:image')) {
    logoBase64 = await cargarImagenComoBase64(lab.logo_url);
  } else if (lab?.logo_url) {
    logoBase64 = lab.logo_url;
  }

  // ── ENCABEZADO ──
  doc.setDrawColor(...gris400);
  doc.rect(marginX, 14, contentWidth, 22);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text('Cotización de Servicios de Laboratorio', marginX + 3, 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Cotización No.: ${nroCotizacionMostrar}`, marginX + 3, 28);

  if (logoBase64) {
    try {
      const maxW = 28;
      const maxH = 18;
      const props = doc.getImageProperties(logoBase64);
      const ratio = props.width / props.height;
      let w = maxW;
      let h = w / ratio;
      if (h > maxH) { h = maxH; w = h * ratio; }
      const boxX = pageWidth - marginX - 28;
      const boxY = 16;
      const offsetX = boxX + (maxW - w) / 2;
      const offsetY = boxY + (maxH - h) / 2;
      doc.addImage(logoBase64, 'PNG', offsetX, offsetY, w, h, undefined, 'FAST');
    } catch (e) { /* no rompe el PDF */ }
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(...azulOsc);
    doc.text(lab?.nombre_alternativo || lab?.nombre || 'LABORATORIO', pageWidth - marginX - 3, 22, { align: 'right' });
    doc.setFont('helvetica', 'normal');
  }

  // ── BLOQUE CLIENTE ──
  let y = 40;
  const mitad = contentWidth / 2;
  doc.setDrawColor(...gris400);
  doc.rect(marginX, y, contentWidth, 28);
  doc.line(marginX + mitad, y, marginX + mitad, y + 28);

  const izq = [
    ['Cliente:', solicitud.empresa_solicitante || solicitud.nombre_solicitante || ''],
    ['RUC o DNI:', solicitud.ruc_dni || ''],
    ['Dirección:', solicitud.direccion || ''],
    ['N° Solicitud:', solicitud.nro_solicitud || ''],
  ];
  const der = [
    ['Solicitante:', solicitud.nombre_solicitante || ''],
    ['Cargo:', solicitud.cargo_solicitante || ''],
    ['Correo:', solicitud.email || ''],
    ['Teléfono:', solicitud.telefono || ''],
  ];

  function pintarBloque(filas, xBase) {
    let yy = y;
    const rowH = 7;
    filas.forEach((fila, idx) => {
      if (idx % 2 === 0) {
        doc.setFillColor(...azulFila);
        doc.rect(xBase, yy, mitad, rowH, 'F');
      }
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);
      doc.text(fila[0], xBase + 2, yy + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.text(String(fila[1]).slice(0, 60), xBase + 26, yy + 4.5);
      yy += rowH;
    });
  }
  pintarBloque(izq, marginX);
  pintarBloque(der, marginX + mitad);

  // ── TABLA DE ÍTEMS ──
  y += 32;
  const filasTabla = itemsArr.map((item, idx) => {
    const precio = precios[idx] || 0;
    const sub = precio * (item.cantidad || 1);
    const desc = descripciones[idx] + (acreditadosArr[idx] ? ' *' : '');
    return [
      String(idx + 1),
      desc,
      item.norma || '',
      String(item.cantidad),
      precio > 0 ? precio.toFixed(2) : '',
      sub > 0 ? sub.toFixed(2) : '',
    ];
  });

  doc.autoTable({
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['Item', 'Descripción del Servicio Ofertado', 'Norma de Referencia', 'Cantidad', `Precio Unitario (${simbolo})`, `Sub Total (${simbolo})`]],
    body: filasTabla,
    theme: 'grid',
    headStyles: { fillColor: azulOsc, textColor: [255, 255, 255], fontSize: 8, halign: 'center' },
    bodyStyles: { fontSize: 8, textColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: grisClr },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: contentWidth - 10 - 28 - 16 - 24 - 24 },
      2: { cellWidth: 28, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 24, halign: 'center' },
      5: { cellWidth: 24, halign: 'center' },
    },
  });

  // ── TOTALES ──
  let yTot = doc.lastAutoTable.finalY + 6;
  const boxW = 60;
  const boxX = marginX + contentWidth - boxW;

  function filaTotal(label, valor, bg, blanco) {
    doc.setFillColor(...bg);
    doc.rect(boxX, yTot, boxW, 7, 'F');
    doc.setDrawColor(...gris400);
    doc.rect(boxX, yTot, boxW, 7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...(blanco ? [255, 255, 255] : [0, 0, 0]));
    doc.text(label, boxX + 3, yTot + 5);
    doc.text(valor, boxX + boxW - 3, yTot + 5, { align: 'right' });
    yTot += 7;
  }

  const hayAcreditados = acreditadosArr.some(Boolean);
  if (hayAcreditados) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.setTextColor(...gris700);
    doc.text('* Ensayo acreditado ante INACAL bajo el alcance de acreditación del laboratorio.', marginX, yTot + 5);
  }

  filaTotal(`SUBTOTAL (${simbolo})`, subtotal.toFixed(2), grisClr, false);
  filaTotal('I.G.V. (18%)', igv.toFixed(2), grisClr, false);
  filaTotal(`Total a Facturar (${simbolo})`, total.toFixed(2), azulOsc, true);

  // ── PIE ──
  yTot += 10;
  const fecha = new Date().toISOString().slice(0, 10);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...gris700);
  const pieX = pageWidth - marginX - 30;
  doc.text('Elaborado por:', pieX, yTot, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(elaboradoPorTexto || '—', pieX + 3, yTot);
  yTot += 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Versión:', pieX, yTot, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(String(versionMostrar || 1).padStart(2, '0'), pieX + 3, yTot);

  yTot += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha:', pieX, yTot, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.text(fecha, pieX + 3, yTot);

  // ── NOTAS ──
  if (notasTexto && notasTexto.trim()) {
    yTot += 10;
    doc.setDrawColor(...gris400);
    doc.line(marginX, yTot, marginX + contentWidth, yTot);
    yTot += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('Nota y Comentarios', marginX, yTot);
    yTot += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gris700);
    const notasLines = doc.splitTextToSize(notasTexto.trim(), contentWidth);
    doc.text(notasLines, marginX, yTot);
  }

  return doc;
}

// ── GENERAR PDF: BORRADOR EN EDICIÓN ──
async function generarPdf(nroCotizacionMostrar, versionMostrar) {
  const { precios, descripciones } = obtenerDatosFormulario();
  return renderPdfDesdeDatos({
    nroCotizacionMostrar,
    versionMostrar,
    monedaUsada: moneda,
    itemsArr: items,
    precios,
    descripciones,
    acreditadosArr: preciosAcreditados,
    notasTexto: notasInput.value,
    elaboradoPorTexto: elaboradoInput.value.trim(),
  });
}

// ── GENERAR PDF: ÚLTIMA COTIZACIÓN YA ENVIADA (datos guardados) ──
async function generarPdfCotizacionGuardada(cotizacion, cotizacionItems) {
  const precios = cotizacionItems.map(it => Number(it.precio_unitario) || 0);
  const descripciones = cotizacionItems.map(it => it.ensayo_nombre);
  const acreditadosArr = cotizacionItems.map(it => it.acreditado === true);

  return renderPdfDesdeDatos({
    nroCotizacionMostrar: cotizacion.nro_cotizacion || solicitud.nro_solicitud || '—',
    versionMostrar: cotizacion.version,
    monedaUsada: cotizacion.moneda || 'USD',
    itemsArr: cotizacionItems,
    precios,
    descripciones,
    acreditadosArr,
    notasTexto: cotizacion.notas || '',
    elaboradoPorTexto: elaboradoInput.value.trim(),
  });
}

// ── CARGAR LA ÚLTIMA COTIZACIÓN ENVIADA DE ESTA SOLICITUD ──
async function cargarUltimaCotizacion(token, solicitudId) {
  const urlCot = `${SUPABASE_URL}/rest/v1/cotizaciones`
    + `?solicitud_id=eq.${solicitudId}&select=*&order=version.desc&limit=1`;
  const resCot = await fetch(urlCot, { headers: authHeaders(token) });
  if (!resCot.ok) throw new Error(`Error al cargar la última cotización (${resCot.status})`);
  const cotData = await resCot.json();
  if (!cotData.length) return null;
  const cotizacion = cotData[0];

  const urlItems = `${SUPABASE_URL}/rest/v1/cotizacion_items`
    + `?cotizacion_id=eq.${cotizacion.id}&order=area_disciplina.asc,ensayo_nombre.asc`;
  const resItems = await fetch(urlItems, { headers: authHeaders(token) });
  if (!resItems.ok) throw new Error(`Error al cargar los ítems de la cotización (${resItems.status})`);
  const cotizacionItems = await resItems.json();

  return { cotizacion, items: cotizacionItems };
}

// ── ABRIR PDF EN VENTANA NUEVA (compatible con Safari iOS / Huawei) ──
// Abre la ventana YA, sincrónicamente con el click, y la redirige al Blob
// una vez el PDF esté listo. Si el navegador bloquea el popup, cae a descarga directa.
function abrirPdfEnNuevaVentana(promesaDoc) {
  const ventana = window.open('', '_blank');
  if (ventana) {
    ventana.document.write(
      '<!DOCTYPE html><html><head><title>Generando PDF...</title></head>' +
      '<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;' +
      'font-family:sans-serif;color:#666;">Generando PDF, un momento…</body></html>'
    );
  }

  promesaDoc
    .then((doc) => {
      const blob = doc.output('blob');
      const url = URL.createObjectURL(blob);
      if (ventana && !ventana.closed) {
        ventana.location.href = url;
      } else {
        // Popup bloqueado: forzamos descarga como respaldo
        const a = document.createElement('a');
        a.href = url;
        a.download = 'cotizacion.pdf';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    })
    .catch((err) => {
      console.error(err);
      if (ventana && !ventana.closed) {
        ventana.document.body.innerHTML =
          '<p style="font-family:sans-serif;color:#c0392b;padding:20px;">Error al generar el PDF.</p>';
      }
      mostrarToast(err.message || 'Error al generar el PDF.', 'danger');
    });
}

// ── BOTÓN: VER PDF (borrador en edición) ──
async function verPdf() {
  if (items.length === 0) {
    mostrarToast('No hay ensayos para mostrar.', 'warning');
    return;
  }
  const token = sessionStorage.getItem('geslasoft_token');

  const promesaDoc = (async () => {
    const versionesPrevias = await contarVersionesPrevias(token, solicitud.id);
    const versionPreview = versionesPrevias + 1;
    const nroPreview = solicitud.nro_solicitud
      ? `(Vista previa — ${solicitud.nro_solicitud})`
      : '(Vista previa)';
    return generarPdf(nroPreview, versionPreview);
  })();

  abrirPdfEnNuevaVentana(promesaDoc);
}
document.getElementById('btnVerPdf').addEventListener('click', verPdf);

// ── BOTÓN: VER ÚLTIMA COTIZACIÓN ENVIADA ──
async function verUltimaCotizacion() {
  const token = sessionStorage.getItem('geslasoft_token');

  const promesaDoc = (async () => {
    const resultado = await cargarUltimaCotizacion(token, solicitud.id);
    if (!resultado) {
      throw new Error('No se encontró una cotización enviada para esta solicitud.');
    }
    return generarPdfCotizacionGuardada(resultado.cotizacion, resultado.items);
  })();

  abrirPdfEnNuevaVentana(promesaDoc);
}
document.getElementById('btnVerUltimaCotizacion').addEventListener('click', verUltimaCotizacion);




// ── GENERAR NRO COTIZACIÓN (consecutivos por laboratorio/año) ──
// La numeración real la calcula la columna generada en Supabase (igual que nro_solicitud).
// Aquí solo armamos los datos para el INSERT; el trigger se encarga del correlativo.

// ── ENVIAR COTIZACIÓN ──
async function enviarCotizacion() {
  if (items.length === 0) {
    mostrarToast('No hay ensayos para cotizar.', 'warning');
    return;
  }

  const precios = [];
  let huboError = false;
  ensayosContainer.querySelectorAll('.precio-input').forEach((input, idx) => {
    const precio = parseFloat(input.value);
    if (isNaN(precio) || precio <= 0) huboError = true;
    precios[idx] = precio || 0;
  });

  if (huboError) {
    mostrarToast('Completa todos los precios unitarios.', 'warning');
    return;
  }

  btnEnviar.disabled = true;
  btnEnviar.textContent = 'Enviando...';

  try {
    const token = sessionStorage.getItem('geslasoft_token');
    const usuario = JSON.parse(sessionStorage.getItem('geslasoft_usuario') || 'null');

    const descripciones = [];
    ensayosContainer.querySelectorAll('.ensayo-desc').forEach((input, idx) => {
      descripciones[idx] = input.value.trim() || items[idx].ensayo_nombre;
    });

    const subtotal = precios.reduce((sum, p, idx) => sum + p * (items[idx].cantidad || 1), 0);
    const igv   = subtotal * 0.18;
    const total = subtotal + igv;

    // ── Calcular versión dinámicamente ──
    const versionesPrevias = await contarVersionesPrevias(token, solicitud.id);
    const nuevaVersion = versionesPrevias + 1;

    // ── 1. Crear cotización ──
    // Nota: subtotal/igv/total NO se guardan en cotizaciones (no existen esas columnas).
    // Se calculan al vuelo a partir de cotizacion_items.precio_total cuando se necesiten mostrar.
    const resCot = await fetch(`${SUPABASE_URL}/rest/v1/cotizaciones`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Prefer': 'return=representation' },
    body: JSON.stringify({
        solicitud_id:       solicitud.id,
        organizacion_id:    solicitud.organizacion_id,
        laboratorio_codigo: solicitud.laboratorio_codigo || null,
        laboratorio_id:     solicitud.laboratorio_id || null,
        nombre_cliente:     solicitud.nombre_solicitante,
        empresa_cliente:    solicitud.empresa_solicitante || null,
        ruc_cliente:        solicitud.ruc_dni || null,
        email_cliente:      solicitud.email || null,
        moneda,
        incluye_igv:        true,
        plazo_entrega_dias: 0,
        validez_dias:       15,
        notas:              notasInput.value.trim() || null,
        estado:             'enviada',
        version:             nuevaVersion,
        enviada_en:          new Date().toISOString(),
    }),
    });

    const cotText = await resCot.text();
    const cotData = cotText ? JSON.parse(cotText) : null;
    if (!resCot.ok) throw new Error(cotData?.message || 'Error al crear la cotización');

    const cotizacion = Array.isArray(cotData) ? cotData[0] : cotData;

    // ── 2. Crear cotizacion_items ──
    // precio_total es columna generada (cantidad * precio_unitario), no se envía.
    const resItems = await fetch(`${SUPABASE_URL}/rest/v1/cotizacion_items`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Prefer': 'return=representation' },
    body: JSON.stringify(items.map((item, idx) => ({
        cotizacion_id:      cotizacion.id,
        organizacion_id:    solicitud.organizacion_id,
        solicitud_item_id:  item.id,
        area_disciplina:    item.area_disciplina,
        ensayo_nombre:      descripciones[idx],
        norma:              item.norma || '',
        cantidad:           item.cantidad,
        precio_unitario:    precios[idx],
        acreditado:         preciosAcreditados[idx] || false,
    }))),
    });

    if (!resItems.ok) {
      const itemsErr = await resItems.text();
      throw new Error(itemsErr || 'Error al guardar los ítems de la cotización');
    }

    mostrarToast(`Cotización ${cotizacion.nro_cotizacion || ''} creada correctamente`, 'accent');

    setTimeout(() => {
      window.location.href = '../panel_lab/requerimiento.html';
    }, 1200);

  } catch (err) {
    console.error(err);
    mostrarToast(err.message || 'Error al enviar la cotización.', 'danger');
    btnEnviar.disabled = false;
    btnEnviar.textContent = 'Enviar cotización';
  }
}
btnEnviar.addEventListener('click', enviarCotizacion);

// ── INIT ──
async function init() {
  const token = sessionStorage.getItem('geslasoft_token');
  const usuarioStr = sessionStorage.getItem('geslasoft_usuario');

  if (!token || !usuarioStr) {
    window.location.href = '../login.html';
    return;
  }

  const usuario = JSON.parse(usuarioStr);
  elaboradoInput.value = usuario.nombre_corto || usuario.nombre_completo || '';

  const solicitudId = obtenerSolicitudId();
  if (!solicitudId) {
    estadoCargando.classList.add('hidden');
    estadoError.classList.remove('hidden');
    errorMsg.textContent = 'No se especificó la solicitud a cotizar.';
    return;
  }

  try {
    const data = await cargarSolicitud(token, solicitudId);
    solicitud = data.solicitud;
    items     = data.items;


    if (items.length === 0) {
      estadoCargando.classList.add('hidden');
      estadoError.classList.remove('hidden');
      errorMsg.textContent = 'Esta solicitud no tiene ensayos registrados.';
      return;
    }

    // ── NUEVO: cargar precios automáticos del laboratorio ──
    const { precios: mapaPrecios, acreditados: mapaAcreditados } =
      await cargarPreciosLaboratorio(token, solicitud.laboratorio_id);
    preciosUsdBase = items.map(item => {
      const precio = mapaPrecios[normalizarCodigo(item.norma)];
      return typeof precio === 'number' ? precio : null;
    });
    preciosAcreditados = items.map(item => mapaAcreditados[normalizarCodigo(item.norma)] === true);

    // ── NUEVO: cargar tasa de cambio sugerida ──
    const tasaSugerida = await cargarTasaCambioSugerida(token, solicitud.laboratorio_id);
    if (tasaSugerida) {
      tipoCambio = tasaSugerida;
      tipoCambioInput.value = tasaSugerida;
    }

    renderInfoSolicitud();
    const versionesExistentes = await contarVersionesPrevias(token, solicitud.id);
    const btnVerUltima = document.getElementById('btnVerUltimaCotizacion');
    btnVerUltima.classList.toggle('hidden', versionesExistentes === 0);



    renderEnsayos();
    calcularTotales();

    estadoCargando.classList.add('hidden');
    cotContenido.classList.remove('hidden');

  } catch (err) {
    console.error(err);
    estadoCargando.classList.add('hidden');
    estadoError.classList.remove('hidden');
    errorMsg.textContent = err.message || 'No se pudo cargar la solicitud.';
  }
}

init();
