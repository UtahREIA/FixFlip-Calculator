// /api/track-event.js
//
// Receives a calculator behavior event from the frontend and forwards it
// to the matching GHL inbound webhook to trigger automated follow-up workflows.
//
// Supported events and their required env vars:
//   finish_analysis     → GHL_FINISH_ANALYSIS_WEBHOOK_URL
//   calculator_access   → GHL_CALCULATOR_ACCESS_WEBHOOK_URL
//
// Payload accepted (POST JSON):
//   { phone: "8015551234", calculator: "BRRRR", event: "finish_analysis" }

// Maps each event type to the Vercel env var that holds its GHL webhook URL.
const EVENT_WEBHOOK_MAP = {
  finish_analysis:   'GHL_FINISH_ANALYSIS_WEBHOOK_URL',
  pdf_download:      'GHL_FINISH_ANALYSIS_WEBHOOK_URL', // legacy alias
  calculator_access: 'GHL_CALCULATOR_ACCESS_WEBHOOK_URL',
};

export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone: rawPhone, calculator, event } = req.body || {};

  if (!rawPhone || !calculator || !event) {
    return res.status(400).json({ error: 'Missing required fields: phone, calculator, event' });
  }

  // Normalize to E.164 format (+1XXXXXXXXXX) for GHL contact lookup
  const digits = String(rawPhone).replace(/\D/g, '').slice(-10);
  const phone = `+1${digits}`;

  const envVar = EVENT_WEBHOOK_MAP[event];
  if (!envVar) {
    return res.status(400).json({ error: `Unknown event type: ${event}` });
  }

  const webhookUrl = process.env[envVar];
  if (!webhookUrl) {
    console.warn(`${envVar} not set — skipping event tracking for "${event}"`);
    return res.status(200).json({ ok: true, tracked: false });
  }

  try {
    const ghlRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone,
        calculator,
        event,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!ghlRes.ok) {
      console.error('GHL webhook returned non-OK status:', ghlRes.status);
    }

    return res.status(200).json({ ok: true, tracked: true });
  } catch (err) {
    console.error('Failed to fire GHL webhook:', err.message);
    // Still return 200 — never surface internal errors to the user
    return res.status(200).json({ ok: true, tracked: false });
  }
}
