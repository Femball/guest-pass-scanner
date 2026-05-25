// Cron J+1 : envoie une enquête de satisfaction aux invités validés de la veille
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReservationRow {
  id: string
  client_name: string
  client_email: string | null
  event_date: string
  is_validated: boolean
}

const generateToken = (): string => {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const formatDateFr = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // AUTH-GUARD: require service role key (cron sends it as Bearer)
  const _authToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (_authToken !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const publicSiteUrl = Deno.env.get('PUBLIC_SITE_URL') ?? 'https://guest-pass-scanner.lovable.app'
  const supabase = createClient(supabaseUrl, serviceKey)

  // Hier en Europe/Paris
  const now = new Date()
  const parisOffsetMs = (now.getTimezoneOffset() + 60) * 60_000
  const yesterday = new Date(now.getTime() + parisOffsetMs - 24 * 60 * 60 * 1000)
  const yesterdayIso = yesterday.toISOString().slice(0, 10)

  console.log(`[feedback-d+1] Looking for validated reservations on ${yesterdayIso}`)

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, client_name, client_email, event_date, is_validated')
    .eq('event_date', yesterdayIso)
    .eq('is_validated', true)
    .not('client_email', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!reservations || reservations.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: 'No validated reservations yesterday' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const ids = reservations.map((r) => r.id)
  const { data: alreadySent } = await supabase
    .from('email_dispatch_log')
    .select('reservation_id')
    .in('reservation_id', ids)
    .eq('dispatch_type', 'feedback_d_plus_1')

  const sentSet = new Set((alreadySent ?? []).map((r) => r.reservation_id))
  const toSend = (reservations as ReservationRow[]).filter((r) => !sentSet.has(r.id) && r.client_email)

  let sent = 0
  let failed = 0
  const eventDateLabel = formatDateFr(yesterdayIso)

  for (const res of toSend) {
    try {
      // Créer ou récupérer le feedback row + token
      const token = generateToken()
      const { error: insertErr } = await supabase.from('event_feedback').insert({
        reservation_id: res.id,
        client_email: res.client_email!,
        client_name: res.client_name,
        event_date: res.event_date,
        token,
      })

      let feedbackToken = token
      if (insertErr) {
        // Probablement déjà créé (unique sur reservation_id) — récupérons le token existant
        const { data: existing } = await supabase
          .from('event_feedback')
          .select('token')
          .eq('reservation_id', res.id)
          .maybeSingle()
        if (!existing?.token) {
          console.error(`[feedback-d+1] Cannot get token for ${res.id}`, insertErr)
          failed++
          continue
        }
        feedbackToken = existing.token
      }

      const feedbackUrl = `${publicSiteUrl}/feedback?token=${feedbackToken}`

      const invokeRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          templateName: 'feedback-request',
          recipientEmail: res.client_email,
          idempotencyKey: `feedback-d1-${res.id}`,
          templateData: {
            mainName: res.client_name.split(' ')[0] || res.client_name,
            feedbackUrl,
            eventDate: eventDateLabel,
          },
        }),
      })

      if (!invokeRes.ok) {
        const t = await invokeRes.text()
        console.error(`[feedback-d+1] Send failed ${res.id}: ${invokeRes.status} ${t}`)
        failed++
        continue
      }

      await supabase.from('email_dispatch_log').insert({
        reservation_id: res.id,
        dispatch_type: 'feedback_d_plus_1',
      })
      sent++
    } catch (e) {
      console.error(`[feedback-d+1] Exception ${res.id}:`, e)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, eventDate: yesterdayIso, total: reservations.length, sent, failed, skipped: sentSet.size }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
