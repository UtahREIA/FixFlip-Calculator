require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors({ origin: '*' }));
// Handle preflight (OPTIONS) requests for all routes
app.options('*', cors({ origin: '*' }));
app.use(express.json());


const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
const AIRTABLE_ID = process.env.AIRTABLE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Verifications';

// Airtable API endpoint
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

// API endpoint to check phone number

// API endpoint to check phone number in Airtable
app.post('/api/check-phone-airtable', async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ valid: false, error: 'No phone provided' });

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
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Airtable API running on port http://localhost:${PORT}/api/check-phone-airtable`));
