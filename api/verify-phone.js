/**
 * Unified verify-phone endpoint for all calculators.
 * Called BY the GHL workflow when a contact is created or status changes.
 * Pass "calculator" in the body to route to the correct Airtable base.
 */

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

    // Map calculator slug to its Airtable env vars
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

    // Check if record already exists
    const searchRes = await fetch(`${BASE_URL}?filterByFormula={Phone Number}="${phone}"`, { headers });
    const searchData = await searchRes.json();

    if (searchData.records && searchData.records.length > 0) {
      // Update existing record
      const recordId = searchData.records[0].id;
      await fetch(`${BASE_URL}/${recordId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          fields: {
            'Approval Status': approved,
            'Name': name || '',
            'Timestamp': new Date().toISOString()
          }
        })
      });
      console.log(`✅ [${calculator}] Updated record for ${phone}`);
    } else {
      // Create new record
      await fetch(BASE_URL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          fields: {
            'Phone Number': phone,
            'Approval Status': approved,
            'Name': name || '',
            'Timestamp': new Date().toISOString()
          }
        })
      });
      console.log(`✅ [${calculator}] Created record for ${phone}`);
    }

    return res.status(200).json({ success: true, calculator });

  } catch (error) {
    console.error('❌ verify-phone error:', error);
    return res.status(500).json({ error: 'Failed to save verification' });
  }
}
