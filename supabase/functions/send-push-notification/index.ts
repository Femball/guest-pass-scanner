import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VAPID_PUBLIC_KEY = 'BGQF7mfNkOUbkwOR0Jez-oTcSlYJc8tWGPT6wCXREToIdKFXTXXP2mHpsdkS-rngo4EVsqXl5O3-mmjLdFjWzGY';
const VAPID_PRIVATE_KEY = 'piQafQ_UdR-Mp_Ib11nNVzusTjq-2Hvqmnjyxp0xH94';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { client_name, event_date } = await req.json();

    webpush.setVapidDetails(
      'mailto:info@laccess.fr',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (error) {
      console.error('Error fetching subscriptions:', error);
      return new Response(JSON.stringify({ error: 'Failed to fetch subscriptions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pushPayload = JSON.stringify({
      title: `🚶 Arrivée : ${client_name}`,
      body: `Vient de scanner son ticket à l'entrée`,
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          expiredEndpoints.push(sub.endpoint);
        } else {
          console.error(`Push failed for ${sub.endpoint}: ${err.statusCode} ${err.body}`);
        }
      }
    }

    // Clean up expired subscriptions
    if (expiredEndpoints.length > 0) {
      await supabase
        .from('push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    }

    return new Response(JSON.stringify({ sent, expired: expiredEndpoints.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('Push notification error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
