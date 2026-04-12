// Supabase Edge Function — send-message
// Handles SMS (Twilio) and Email (Resend) broadcasting.
// WhatsApp is handled via wa.me on the frontend (no API needed).
//
// Required secrets (set via `supabase secrets set`):
//   TWILIO_ACCOUNT_SID   — Twilio account SID
//   TWILIO_AUTH_TOKEN    — Twilio auth token
//   TWILIO_SMS_FROM      — Twilio verified phone number e.g. +12345678901
//   RESEND_API_KEY       — Resend API key (re_...)
//   RESEND_FROM_EMAIL    — Verified sender address e.g. noreply@yourdomain.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }

  try {
    const { channel, recipients, message } = await req.json() as {
      channel: 'sms' | 'email';
      recipients: { number?: string; email?: string; name?: string }[];
      message: string;
    };

    if (!channel || !recipients?.length || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    if (channel === 'sms') {
      const sid = Deno.env.get('TWILIO_ACCOUNT_SID');
      const token = Deno.env.get('TWILIO_AUTH_TOKEN');
      const from = Deno.env.get('TWILIO_SMS_FROM');

      if (!sid || !token || !from) {
        return new Response(JSON.stringify({ error: 'Twilio credentials not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM secrets.' }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      const auth = btoa(`${sid}:${token}`);
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;

      for (const r of recipients) {
        if (!r.number) { failed++; continue; }
        const to = r.number.replace(/[^\d+]/g, '');
        if (!to) { failed++; continue; }
        try {
          const body = new URLSearchParams({ From: from, To: to, Body: message });
          const res = await fetch(url, {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          });
          if (res.ok) { sent++; } else {
            const errBody = await res.text();
            errors.push(`${to}: ${errBody}`);
            failed++;
          }
        } catch (e: any) {
          errors.push(`${to}: ${e.message}`);
          failed++;
        }
      }
    } else if (channel === 'email') {
      const apiKey = Deno.env.get('RESEND_API_KEY');
      const fromEmail = Deno.env.get('RESEND_FROM_EMAIL');

      if (!apiKey || !fromEmail) {
        return new Response(JSON.stringify({ error: 'Resend credentials not configured. Set RESEND_API_KEY and RESEND_FROM_EMAIL secrets.' }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }

      // Batch into groups of 50 (Resend limit)
      const BATCH = 50;
      for (let i = 0; i < recipients.length; i += BATCH) {
        const batch = recipients.slice(i, i + BATCH);
        const to = batch.filter(r => r.email).map(r => r.email as string);
        if (!to.length) { failed += batch.length; continue; }
        try {
          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: fromEmail, to, subject: 'School Notification', text: message }),
          });
          if (res.ok) { sent += to.length; } else {
            const errBody = await res.text();
            errors.push(`Batch ${i / BATCH + 1}: ${errBody}`);
            failed += to.length;
          }
        } catch (e: any) {
          errors.push(`Batch ${i / BATCH + 1}: ${e.message}`);
          failed += batch.length;
        }
      }
    } else {
      return new Response(JSON.stringify({ error: `Unsupported channel: ${channel}` }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ sent, failed, errors }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    });
  }
});
