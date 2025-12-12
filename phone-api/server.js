require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();

// Manual CORS headers for all requests (including serverless)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});
app.use(express.json());


const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
const AIRTABLE_ID = process.env.AIRTABLE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Verifications';

// Airtable API endpoint
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

// API endpoint to check phone number

// API endpoint to check phone number in Airtable
app.post('/api/check-phone-airtable', async (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ valid: false, error: 'No phone provided' });
  // Normalize phone to digits only and get last 10 digits
  const originalPhone = phone;
  phone = phone.replace(/\D/g, '');
  const last10 = phone.slice(-10);

  // Build filter formula
  const filterFormula =
    `AND(` +
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}', ` +
    `{Approval Status} = 1)`;

  // Logging for debugging
  console.log('--- Phone Verification Debug ---');
  console.log('Original phone input:', originalPhone);
  console.log('Normalized phone:', phone);
  console.log('Last 10 digits:', last10);
  console.log('Airtable filter formula:', filterFormula);

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
    console.log('Airtable response record count:', records.length);
    if (records.length > 0) {
      const record = records[0];
      console.log('Matched record fields:', record.fields);
      res.json({ valid: true, name: record.fields.Name || '', status: 'Active' });
    } else {
      console.log('No matching record found.');
      res.json({ valid: false });
    }
  } catch (err) {
    console.error('Airtable API error:', err.message);
    res.status(500).json({ valid: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Airtable API running on port http://localhost:${PORT}/api/check-phone-airtable`));
