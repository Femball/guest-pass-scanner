// Cron lundi 9h : rapport hebdo (CA, validation, feedback) envoyé à l'admin
import { createClient } from 'npm:@supabase/supabase-js@2'

const ADMIN_EMAIL = 'wgwada971@gmail.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const fmtDate = (d: Date) =>
  d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Semaine passée : lundi -> dimanche
  const now = new Date()
  const day = now.getDay() // 0=dim, 1=lun
  const daysSinceLastMonday = day === 0 ? 13 : 6 + day // remonter au lundi N-1
  const start = new Date(now)
  start.setDate(now.getDate() - daysSinceLastMonday)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)

  const startIso = start.toISOString().slice(0, 10)
  const endIso = end.toISOString().slice(0, 10)

  console.log(`[weekly-report] ${startIso} → ${endIso}`)

  const { data: reservations } = await supabase
    .from('reservations')
    .select('id, number_of_persons, is_validated, amount, payment_method, payment_status')
    .gte('event_date', startIso)
    .lte('event_date', endIso)

  const { data: feedbacks } = await supabase
    .from('event_feedback')
    .select('rating, comment, client_name')
    .gte('event_date', startIso)
    .lte('event_date', endIso)
    .not('submitted_at', 'is', null)

  const total = reservations?.length ?? 0
  const totalPersons = reservations?.reduce((s, r) => s + (r.number_of_persons || 1), 0) ?? 0
  const validated = reservations?.filter((r) => r.is_validated).length ?? 0
  const validationRate = total > 0 ? Math.round((validated / total) * 100) : 0
  const ca = reservations
    ?.filter((r) => r.payment_status === 'paid')
    .reduce((s, r) => s + Number(r.amount || 0), 0) ?? 0
  const cashCa = reservations
    ?.filter((r) => r.payment_method === 'cash' && r.payment_status === 'paid')
    .reduce((s, r) => s + Number(r.amount || 0), 0) ?? 0
  const cardCa = reservations
    ?.filter((r) => r.payment_method === 'card' && r.payment_status === 'paid')
    .reduce((s, r) => s + Number(r.amount || 0), 0) ?? 0

  const ratings = (feedbacks ?? []).map((f) => f.rating).filter((r): r is number => r != null)
  const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : 'N/A'
  const topComments = (feedbacks ?? [])
    .filter((f) => f.comment && f.comment.trim().length > 0)
    .slice(0, 3)

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;background:#fff">
      <h1 style="color:#000;font-size:22px">📊 Rapport hebdo L'Access</h1>
      <p style="color:#666">Du ${fmtDate(start)} au ${fmtDate(end)}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>

      <h2 style="font-size:16px;color:#000">💰 Chiffre d'affaires</h2>
      <p style="font-size:24px;font-weight:bold;color:#c9a84c;margin:0">${fmtMoney(ca)}</p>
      <p style="font-size:13px;color:#666">Espèces : ${fmtMoney(cashCa)} · Carte : ${fmtMoney(cardCa)}</p>

      <h2 style="font-size:16px;color:#000;margin-top:24px">🎫 Réservations</h2>
      <p style="font-size:14px;color:#333">
        <strong>${total}</strong> réservations · <strong>${totalPersons}</strong> personnes<br/>
        Taux de validation : <strong>${validationRate}%</strong> (${validated}/${total})
      </p>

      <h2 style="font-size:16px;color:#000;margin-top:24px">⭐ Satisfaction</h2>
      <p style="font-size:14px;color:#333">
        Note moyenne : <strong>${avgRating}/5</strong> (${ratings.length} avis)
      </p>
      ${topComments.length > 0 ? `
        <h3 style="font-size:14px;color:#000;margin-top:16px">Top commentaires :</h3>
        ${topComments.map((c) => `
          <div style="background:#f8f5ed;padding:12px;border-radius:6px;margin-bottom:8px">
            <p style="margin:0;font-size:13px;color:#333">"${c.comment}"</p>
            <p style="margin:4px 0 0;font-size:11px;color:#888">— ${c.client_name} · ${c.rating}/5 ⭐</p>
          </div>
        `).join('')}
      ` : ''}

      <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
      <p style="font-size:12px;color:#999;text-align:center">L'Access · Rapport automatique</p>
    </div>
  `

  const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
    body: JSON.stringify({
      templateName: 'weekly-report',
      recipientEmail: ADMIN_EMAIL,
      idempotencyKey: `weekly-report-${startIso}`,
      templateData: { html, periodLabel: `${fmtDate(start)} → ${fmtDate(end)}` },
    }),
  })

  if (!sendRes.ok) {
    const t = await sendRes.text()
    console.error('[weekly-report] send failed:', sendRes.status, t)
    return new Response(JSON.stringify({ error: 'send failed', detail: t }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(
    JSON.stringify({ ok: true, period: { start: startIso, end: endIso }, total, ca, avgRating }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
