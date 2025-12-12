const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let phone;
  try {
    // Vercel does not auto-parse JSON body
    if (req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
      req.body = JSON.parse(req.body);
    }
    phone = req.body.phone;
  } catch (e) {
    return res.status(400).json({ valid: false, error: 'Invalid JSON body' });
  }
  if (!phone) return res.status(400).json({ valid: false, error: 'No phone provided' });

  phone = phone.replace(/\D/g, '');
  const last10 = phone.slice(-10);

  const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
  const AIRTABLE_ID = process.env.AIRTABLE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Verifications';
  const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

  const filterFormula =
    `AND(` +
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}', ` +
    `{Approval Status} = 1)`;

  try {
    const response = await axios.get(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`
      },
      params: {
        filterByFormula: filterFormula
      }
    });
    const records = response.data.records;
    if (records.length > 0) {
      const record = records[0];
      res.json({ valid: true, name: record.fields.Name || '', status: 'Active' });
    } else {
      res.json({ valid: false });
    }
  } catch (err) {
    res.status(500).json({ valid: false, error: err.message });
  }
};
