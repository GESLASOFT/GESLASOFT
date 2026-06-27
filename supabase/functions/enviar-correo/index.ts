import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CORREO_PRUEBA  = "julio.velasquez21293@gmail.com";
//Después de cualquier cambio recuerda ejecutar en terminal: supabase functions deploy enviar-correo --no-verify-jwt

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      nro_solicitud,
      nombre_solicitante,
      empresa_solicitante,
      ruc_dni,
      direccion,
      cargo_solicitante,
      telefono,
      email,
      nombre_proyecto,
      ubicacion,
      observaciones,
      items,
      lab_nombre,
      lab_codigo,
      lab_telefono,
      lab_email,
      lab_nombre_alternativo
    } = await req.json();

    // ── AGRUPAR ITEMS POR DISCIPLINA ──
    const grupos: Record<string, any[]> = {};
    items.forEach((item: any) => {
      if (!grupos[item.area_disciplina]) grupos[item.area_disciplina] = [];
      grupos[item.area_disciplina].push(item);
    });

    const itemsHtml = Object.entries(grupos).map(([disc, ensayos]) => `
      <tr><td colspan="3" style="padding:8px 0 4px;font-weight:700;color:#0097A7;font-size:12px;">
        ${disc.toUpperCase()}
      </td></tr>
      ${(ensayos as any[]).map((e: any) => `
        <tr>
          <td style="padding:4px 8px;font-size:12px;color:#607D8B;">${e.norma}</td>
          <td style="padding:4px 8px;font-size:12px;color:#455A64;">${e.ensayo_nombre}</td>
          <td style="padding:4px 8px;font-size:12px;color:#1A2E3B;text-align:center;font-weight:700;">x${e.cantidad}</td>
        </tr>`).join('')}
    `).join('');

    const totalItems = (items as any[]).reduce((acc: number, i: any) => acc + i.cantidad, 0);

    // ── HTML CORREO LABORATORIO ──
    const htmlLab = `
    <div style="background:#F4F6F8;padding:32px;font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#1A2E3B;">GESLA<span style="color:#0097A7;">SOFT</span></span>
        <p style="color:#607D8B;font-size:12px;margin:4px 0 0;">Sistema de Gestión de Laboratorio · ISO/IEC 17025</p>
      </div>
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;border-left:4px solid #0097A7;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#607D8B;font-size:11px;margin:0 0 4px;">NUEVA SOLICITUD DE ENSAYOS</p>
        <p style="color:#1A2E3B;font-size:20px;font-weight:700;margin:0;">${nro_solicitud}</p>
        <p style="color:#F59E0B;font-size:12px;margin:4px 0 0;">🟡 ESTADO: NUEVA</p>
      </div>
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 10px;">🏢 DATOS DEL CLIENTE</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#607D8B;font-size:12px;padding:3px 0;width:120px;">Empresa</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${empresa_solicitante}</td></tr>
          ${ruc_dni ? `<tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">RUC/DNI</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${ruc_dni}</td></tr>` : ''}
          ${direccion ? `<tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">Dirección</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${direccion}</td></tr>` : ''}
        </table>
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:14px 0 10px;">👤 DATOS DEL SOLICITANTE</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#607D8B;font-size:12px;padding:3px 0;width:120px;">Nombre</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${nombre_solicitante}</td></tr>
          ${cargo_solicitante ? `<tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">Cargo</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${cargo_solicitante}</td></tr>` : ''}
          <tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">Teléfono</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">📞 ${telefono}</td></tr>
          <tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">Correo</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">✉ ${email}</td></tr>
        </table>
      </div>
      ${nombre_proyecto ? `
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 10px;">📍 PROYECTO</p>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="color:#607D8B;font-size:12px;padding:3px 0;width:120px;">Nombre</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${nombre_proyecto}</td></tr>
          ${ubicacion ? `<tr><td style="color:#607D8B;font-size:12px;padding:3px 0;">Ubicación</td>
              <td style="color:#1A2E3B;font-size:12px;padding:3px 0;">${ubicacion}</td></tr>` : ''}
        </table>
      </div>` : ''}
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 10px;">📋 ENSAYOS SOLICITADOS</p>
        <table style="width:100%;border-collapse:collapse;">
          ${itemsHtml}
        </table>
        <p style="color:#607D8B;font-size:12px;margin:12px 0 0;">
          TOTAL: <span style="color:#1A2E3B;font-weight:700;">${totalItems} ítem${totalItems !== 1 ? 's' : ''}</span>
        </p>
      </div>
      ${observaciones ? `
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 8px;">📝 OBSERVACIONES</p>
        <p style="color:#455A64;font-size:12px;margin:0;font-style:italic;">"${observaciones}"</p>
      </div>` : ''}
      <div style="background:#E0F7FA;border:1px solid #0097A7;border-radius:8px;padding:14px;margin-bottom:24px;">
        <p style="color:#0097A7;font-size:12px;font-weight:700;margin:0;">⚡ ACCIÓN REQUERIDA</p>
        <p style="color:#455A64;font-size:12px;margin:6px 0 0;">Contacta al solicitante para coordinar la recepción de muestras y entrega de resultados.</p>
      </div>
      <p style="color:#90A4AE;font-size:11px;text-align:center;margin:0;">
        GESLASOFT · ISO/IEC 17025<br>Este correo fue generado automáticamente.
      </p>
    </div>`;

    // ── HTML CORREO CLIENTE ──
    const htmlCliente = `
    <div style="background:#F4F6F8;padding:32px;font-family:'Segoe UI',sans-serif;max-width:600px;margin:auto;border-radius:12px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:22px;font-weight:900;letter-spacing:2px;color:#1A2E3B;">GESLA<span style="color:#0097A7;">SOFT</span></span>
        <p style="color:#607D8B;font-size:12px;margin:4px 0 0;">Sistema de Gestión de Laboratorio · ISO/IEC 17025</p>
      </div>
      <div style="text-align:center;margin-bottom:24px;">
        <div style="background:#0097A7;border-radius:50%;width:56px;height:56px;display:inline-flex;align-items:center;justify-content:center;">
          <span style="font-size:24px;color:#fff;">✓</span>
        </div>
        <h2 style="color:#1A2E3B;font-size:18px;margin:12px 0 4px;">¡Solicitud recibida!</h2>
        <p style="color:#607D8B;font-size:13px;margin:0;">Hola, <strong style="color:#1A2E3B;">${nombre_solicitante}</strong>. Tu solicitud fue registrada correctamente.</p>
      </div>
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#607D8B;font-size:11px;margin:0 0 4px;">N° DE SOLICITUD</p>
        <p style="color:#0097A7;font-size:24px;font-weight:900;margin:0;">${nro_solicitud}</p>
        <p style="color:#90A4AE;font-size:11px;margin:4px 0 0;">${lab_nombre_alternativo}</p>
      </div>
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 10px;">📋 ENSAYOS SOLICITADOS</p>
        <table style="width:100%;border-collapse:collapse;">
          ${itemsHtml}
        </table>
      </div>
      ${observaciones ? `
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 8px;">📝 OBSERVACIONES</p>
        <p style="color:#455A64;font-size:12px;margin:0;font-style:italic;">"${observaciones}"</p>
      </div>` : ''}
      <div style="background:#FFFFFF;border-radius:8px;padding:16px;margin-bottom:24px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
        <p style="color:#0097A7;font-size:11px;font-weight:700;margin:0 0 10px;">📇 CONTACTO DEL LABORATORIO</p>
        <p style=""color:#455A64;font-size:12px;margin:4px 0 0;">🏢 ${lab_nombre}</p>
        ${lab_telefono ? `<p style="color:#455A64;font-size:12px;margin:4px 0 0;">📞 ${lab_telefono}</p>` : ''}
        ${lab_email ? `<p style="color:#455A64;font-size:12px;margin:4px 0 0;">✉ ${lab_email}</p>` : ''}
      </div>
      <p style="color:#90A4AE;font-size:11px;text-align:center;margin:0;">
        GESLASOFT · ISO/IEC 17025<br>Este correo fue generado automáticamente.
      </p>
      
    </div>`;

    // ── ENVIAR CORREO AL LABORATORIO ──
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "onboarding@resend.dev",
        to:      [CORREO_PRUEBA],
        subject: `🔬 Nueva solicitud — ${nro_solicitud} | GESLASOFT`,
        html:    htmlLab,
      }),
    });

    // ── ENVIAR CORREO AL CLIENTE ──
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "onboarding@resend.dev",
        to:      [CORREO_PRUEBA],
        subject: `✅ Solicitud recibida — ${nro_solicitud} | GESLASOFT`,
        html:    htmlCliente,
      }),
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
