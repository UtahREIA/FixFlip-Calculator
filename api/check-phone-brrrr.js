// API endpoint for BRRRR Calculator phone verification (Airtable)
// Place in: BRRRR Calculator/api/check-phone-brrrr.js

const axios = require('axios');


export default async function handler(req, res) {
  // Always set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).send('OK');
    return;
  }

  // Only allow POST
  if (req.method !== 'POST') {
    res.status(405).setHeader('Access-Control-Allow-Origin', '*').json({ error: 'Method not allowed' });
    return;
  }

  let phone;
  try {
    if (req.headers['content-type'] === 'application/json' && typeof req.body === 'string') {
      req.body = JSON.parse(req.body);
    }
    phone = req.body.phone;
  } catch (e) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ valid: false, error: 'Invalid JSON body' });
  }
  if (!phone) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ valid: false, error: 'No phone provided' });
  }

  phone = phone.replace(/\D/g, '');
  const last10 = phone.slice(-10);

  const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY_BRRRR;
  const AIRTABLE_ID = process.env.AIRTABLE_BASE_ID_BRRRR;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME_BRRRR || 'Verifications';
  const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

  // First, try to find an active member
  const filterActive =
    `AND(` +
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}', ` +
    `{Approval Status} = 'Approved', {Member Status} = 'Active')`;

  // If not active, try to find any contact with this phone
  const filterAny =
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}'`;

  try {
    // 1. Check for active member
    let response = await axios.get(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`
      },
      params: {
        filterByFormula: filterActive
      }
    });
    let records = response.data.records;
    if (records.length > 0) {
      const record = records[0];
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ valid: true, name: record.fields.Name || '', status: 'Active', trial: false });
    }

    // 2. Check for any contact (not active)
    response = await axios.get(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`
      },
      params: {
        filterByFormula: filterAny
      }
    });
    records = response.data.records;
    if (records.length === 0) {
      // No such contact
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ valid: false });
    }
    const record = records[0];
    const recordId = record.id;
    const fields = record.fields;
    const name = fields.Name || '';
    const firstAccess = fields['First Access Date'];
    const memberStatus = (fields['Member Status'] || '').toLowerCase();

    // If Member Status is 'active', grant unlimited access
    if (memberStatus === 'active') {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ valid: true, name, status: 'Active', trial: false });
    }

    // If no First Access Date, set it to today
    let trialStart = firstAccess;
    let trialDaysLeft = 0;
    let trialExpired = false;
    let today = new Date();
    if (!firstAccess) {
      const isoToday = today.toISOString().split('T')[0];
      await axios.patch(`${AIRTABLE_URL}/${recordId}`, {
        fields: { 'First Access Date': isoToday }
      }, {
        headers: { Authorization: `Bearer ${AIRTABLE_KEY}` }
      });
      trialStart = isoToday;
      trialDaysLeft = 30;
    } else {
      const start = new Date(firstAccess);
      const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
      trialDaysLeft = 30 - diff;
      if (trialDaysLeft < 0) trialDaysLeft = 0;
      trialExpired = diff > 30;
    }

    if (!trialExpired) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ valid: true, name, status: 'Trial', trial: true, trialDaysLeft });
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.json({ valid: false, name, status: 'Trial Expired', trial: true, trialDaysLeft: 0 });
    }
  } catch (err) {
    console.error('BRRRR verification error:', err?.message, err?.response?.data);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ valid: false, error: err.message, airtable: err?.response?.data });
  }
};
