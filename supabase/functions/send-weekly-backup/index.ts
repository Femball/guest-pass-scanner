// Cron dimanche 23h : backup CSV complet des réservations envoyé à l'admin
import { createClient } from 'npm:@supabase/supabase-js@2'

const ADMIN_EMAIL = 'wgwada971@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const csvEscape = (v: unknown) => {
  if (v == null) return ''
  const s = String(v)
  if (/[",;\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, client_name, client_email, event_date, number_of_persons, is_validated, validated_at, amount, payment_method, payment_status, qr_code, created_at')
    .order('event_date', { ascending: false })
    .limit(5000)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const headers = ['id','nom','email','date_event','personnes','validé','validé_le','montant','méthode','statut_paiement','qr_code','créé_le']
  const rows = (reservations ?? []).map((r) => [
    r.id, r.client_name, r.client_email ?? '', r.event_date, r.number_of_persons,
    r.is_validated ? 'oui' : 'non', r.validated_at ?? '', r.amount ?? '',
    r.payment_method ?? '', r.payment_status ?? '', r.qr_code, r.created_at,
  ].map(csvEscape).join(';'))
  const csv = '\uFEFF' + [headers.join(';'), ...rows].join('\n')
  const csvB64 = btoa(unescape(encodeURIComponent(csv)))

  const today = new Date().toISOString().slice(0, 10)
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#fff">
      <h1 style="color:#000;font-size:22px">💾 Backup hebdo L'Access</h1>
      <p style="color:#333;font-size:14px">
        Sauvegarde du ${today} — <strong>${reservations?.length ?? 0}</strong> réservations exportées.
      </p>
      <p style="color:#666;font-size:13px">
        Le fichier CSV est ci-dessous (compatible Excel, encodage UTF-8 BOM, séparateur point-virgule).
      </p>
      <details style="margin-top:20px">
        <summary style="cursor:pointer;color:#c9a84c">Données brutes (CSV)</summary>
        <pre style="background:#f8f5ed;padding:12px;border-radius:6px;font-size:10px;overflow:auto;max-height:300px">${csv.slice(0, 2000)}${csv.length > 2000 ? '\n...(tronqué)' : ''}</pre>
      </details>
      <p style="font-size:11px;color:#999;margin-top:16px">
        Données encodées en base64 (à coller dans un décodeur si besoin) :<br/>
        <textarea readonly style="width:100%;height:60px;font-family:monospace;font-size:9px">${csvB64}</textarea>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#999;text-align:center">L'Access · Backup automatique hebdomadaire</p>
    </div>
  `

  const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      templateName: 'weekly-backup',
      recipientEmail: ADMIN_EMAIL,
      idempotencyKey: `weekly-backup-${today}`,
      templateData: { html, count: reservations?.length ?? 0, date: today },
    }),
  })

  if (!sendRes.ok) {
    const t = await sendRes.text()
    console.error('[weekly-backup] send failed:', sendRes.status, t)
    return new Response(JSON.stringify({ error: 'send failed', detail: t }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, count: reservations?.length ?? 0, date: today }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
