// Cron J-1 : envoie un rappel par email avec le QR code à tous les invités de demain
// Invocation : pg_cron quotidien (10:00 Europe/Paris)
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ReservationRow {
  id: string
  qr_code: string
  client_name: string
  client_email: string | null
  number_of_persons: number
  event_date: string
  payment_method: string | null
  payment_status: string | null
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
  const supabase = createClient(supabaseUrl, serviceKey)

  // Demain en Europe/Paris (UTC+1/+2)
  const now = new Date()
  const parisOffsetMs = (now.getTimezoneOffset() + 60) * 60_000
  const tomorrow = new Date(now.getTime() + parisOffsetMs + 24 * 60 * 60 * 1000)
  const tomorrowIso = tomorrow.toISOString().slice(0, 10)

  console.log(`[reminder-d-1] Looking for reservations on ${tomorrowIso}`)

  const { data: reservations, error } = await supabase
    .from('reservations')
    .select('id, qr_code, client_name, client_email, number_of_persons, event_date, payment_method, payment_status')
    .eq('event_date', tomorrowIso)
    .not('client_email', 'is', null)

  if (error) {
    console.error('[reminder-d-1] DB error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!reservations || reservations.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, skipped: 0, message: 'No reservations tomorrow' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Filtrer celles déjà envoyées (idempotence)
  const ids = reservations.map((r) => r.id)
  const { data: alreadySent } = await supabase
    .from('email_dispatch_log')
    .select('reservation_id')
    .in('reservation_id', ids)
    .eq('dispatch_type', 'reminder_d_minus_1')

  const sentSet = new Set((alreadySent ?? []).map((r) => r.reservation_id))
  const toSend = (reservations as ReservationRow[]).filter((r) => !sentSet.has(r.id) && r.client_email)

  let sent = 0
  let failed = 0
  const eventDateLabel = formatDateFr(tomorrowIso)

  for (const res of toSend) {
    try {
      // Skip if card payment unpaid
      if (res.payment_method === 'card' && res.payment_status !== 'paid') {
        console.log(`[reminder-d-1] Skip ${res.id} (card unpaid)`)
        continue
      }

      const tickets = Array.from({ length: res.number_of_persons }).map((_, i) => ({
        clientName: res.number_of_persons > 1 ? `${res.client_name} (${i + 1}/${res.number_of_persons})` : res.client_name,
        qrCode: res.qr_code,
      }))

      const invokeRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          templateName: 'reminder-day-before',
          recipientEmail: res.client_email,
          idempotencyKey: `reminder-d1-${res.id}`,
          templateData: {
            mainName: res.client_name.split(' ')[0] || res.client_name,
            eventDate: eventDateLabel,
            tickets,
          },
        }),
      })

      if (!invokeRes.ok) {
        const t = await invokeRes.text()
        console.error(`[reminder-d-1] Send failed ${res.id}: ${invokeRes.status} ${t}`)
        failed++
        continue
      }

      await supabase.from('email_dispatch_log').insert({
        reservation_id: res.id,
        dispatch_type: 'reminder_d_minus_1',
      })
      sent++
    } catch (e) {
      console.error(`[reminder-d-1] Exception ${res.id}:`, e)
      failed++
    }
  }

  return new Response(
    JSON.stringify({ ok: true, eventDate: tomorrowIso, total: reservations.length, sent, failed, skipped: sentSet.size }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
