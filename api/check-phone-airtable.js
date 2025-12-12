// Vercel serverless function for /api/check-phone-airtable with CORS
// Place this file at /api/check-phone-airtable.js in your Vercel project root

import axios from 'axios';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ valid: false, error: 'No phone provided' });

  const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
  const AIRTABLE_ID = process.env.AIRTABLE_ID;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Verifications';
  const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

  try {
    const response = await axios.get(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`
      },
      params: {
        filterByFormula: `AND({Phone Number} = '${phone}', {Approval Status} = 1)`
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
}
