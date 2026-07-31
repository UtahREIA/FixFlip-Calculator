/**
 * Unified verify-phone endpoint for all calculators.
 * Called BY the GHL workflow when a contact is created or status changes.
 * Pass "calculator" in the body to route to the correct Airtable base.
 */

// Airtable allows 5 requests/sec per base. When a burst of contacts fires
// in quick succession (bulk enrollment, mass status change, etc.), Airtable
// responds with 429 + RATE_LIMIT_REACHED instead of queueing the request
// for you. This wrapper retries on that specific error with a short,
// increasing delay instead of failing the whole verification outright.
async function fetchWithRetry(url, options, maxRetries = 4) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, options);

    if (res.status !== 429) return res;

    const data = await res.clone().json().catch(() => null);
    const isRateLimit = data?.error?.type === 'RATE_LIMIT_REACHED' || res.status === 429;

    if (!isRateLimit || attempt === maxRetries) return res;

    // Airtable doesn't send a Retry-After header, so back off with
    // increasing delay: ~500ms, 1s, 2s, 4s.
    const delayMs = 500 * Math.pow(2, attempt);
    console.warn(`⏳ Airtable rate limit hit, retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries})`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { phone, approved, name, calculator = 'fixflip' } = body;
    if (!phone) return res.status(400).json({ error: 'No phone provided' });

    const envMap = {
      fixflip:   { key: process.env.AIRTABLE_API_KEY,            id: process.env.AIRTABLE_BASE_ID },
      brrrr:     { key: process.env.AIRTABLE_API_KEY_BRRRR,      id: process.env.AIRTABLE_BASE_ID_BRRRR },
      rental:    { key: process.env.AIRTABLE_API_KEY_RENTAL,     id: process.env.AIRTABLE_BASE_ID_RENTAL },
      shortterm: { key: process.env.AIRTABLE_API_KEY_SHORT_TERM, id: process.env.AIRTABLE_BASE_SHORT_TERM },
    };
    const env = envMap[calculator];
    if (!env) return res.status(400).json({ error: `Unknown calculator: "${calculator}". Valid values: fixflip, brrrr, rental, shortterm` });

    const { key: AIRTABLE_API_KEY, id: AIRTABLE_BASE_ID } = env;
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      return res.status(500).json({ error: `Missing Airtable env vars for calculator: ${calculator}` });
    }

    const AIRTABLE_TABLE = 'Verifications';
    const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`;
    const headers = {
      'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
      'Content-Type': 'application/json'
    };

    // "Timestamp" in this base is a Created Time field (computed by
    // Airtable itself), so it's deliberately left out here. Computed
    // fields are read-only via the API, writing to them is what was
    // causing the 422. Airtable will stamp the time automatically
    // when the record is created; there's nothing to set on update.
    const fieldsPayload = {
      'Phone Number': phone,
      'Approval Status': approved,
      'Name': name || ''
    };

    // Upsert: one call that creates the record if "Phone Number" doesn't
    // already exist, or updates it if it does. This replaces the old
    // search-then-create/update pattern, which cost 2 requests per contact.
    // At your volume (4,000+ contacts per base), that's the difference
    // between 8,000 and 4,000 requests against the 5 req/sec ceiling.
    const airtableRes = await fetchWithRetry(BASE_URL, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        performUpsert: { fieldsToMergeOn: ['Phone Number'] },
        records: [{ fields: fieldsPayload }],
        typecast: true
      })
    });

    const airtableData = await airtableRes.json();

    if (!airtableRes.ok) {
      // This is the part that was previously silent. Airtable's response
      // body tells you exactly which field/value it rejected (or, for a
      // 429, that retries were exhausted after the backoff attempts above).
      console.error(`❌ [${calculator}] Airtable write failed (${airtableRes.status}):`, JSON.stringify(airtableData));
      return res.status(airtableRes.status).json({
        error: 'Airtable write failed',
        airtableStatus: airtableRes.status,
        airtableError: airtableData?.error || airtableData
      });
    }

    const wasCreated = airtableData.createdRecords && Object.keys(airtableData.createdRecords).length > 0;
    console.log(`✅ [${calculator}] ${wasCreated ? 'Created' : 'Updated'} record for ${phone}`);
    return res.status(200).json({ success: true, calculator });

  } catch (error) {
    console.error('❌ verify-phone error:', error);
    return res.status(500).json({ error: 'Failed to save verification', details: error.message });
  }
}
