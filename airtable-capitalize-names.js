// Node.js script to capitalize all contact names in Airtable
// Instructions:
// 1. Install dependencies: npm install axios dotenv
// 2. Ensure your .env file has AIRTABLE_KEY, AIRTABLE_ID, AIRTABLE_TABLE_NAME
// 3. Run: node airtable-capitalize-names.js

require('dotenv').config({ path: './phone-api/.env' });
const axios = require('axios');

const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
const AIRTABLE_ID = process.env.AIRTABLE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

async function getAllRecords() {
  let allRecords = [];
  let offset = undefined;
  do {
    const params = { pageSize: 100 };
    if (offset) params.offset = offset;
    const response = await axios.get(AIRTABLE_URL, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
      params,
    });
    allRecords = allRecords.concat(response.data.records);
    offset = response.data.offset;
  } while (offset);
  return allRecords;
}

function capitalizeName(name) {
  return name
    ? name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
}

async function updateName(recordId, name) {
  const capName = capitalizeName(name);
  await axios.patch(`${AIRTABLE_URL}/${recordId}`, {
    fields: { Name: capName },
  }, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  await new Promise(resolve => setTimeout(resolve, 300));
}

(async () => {
  try {
    const records = await getAllRecords();
    let updated = 0;
    for (const record of records) {
      const name = record.fields.Name;
      if (name && name !== capitalizeName(name)) {
        await updateName(record.id, name);
        updated++;
        console.log(`Updated: ${name} -> ${capitalizeName(name)}`);
      }
    }
    console.log(`Capitalization complete. ${updated} records updated.`);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
