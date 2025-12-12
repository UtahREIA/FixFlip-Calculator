// Node.js script to match phone numbers from GHL active members CSV to Airtable records and set 'Member Status' to 'Active'
// Instructions:
// 1. Install dependencies: npm install axios dotenv csv-parser
// 2. Ensure your .env file has AIRTABLE_KEY, AIRTABLE_ID, AIRTABLE_TABLE_NAME
// 3. Place your GHL active members CSV as 'ghl_contacts.csv' in the workspace
// 4. Run: node airtable-set-active.js

require('dotenv').config({ path: './phone-api/.env' });
const axios = require('axios');
const fs = require('fs');
const csv = require('csv-parser');

const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
const AIRTABLE_ID = process.env.AIRTABLE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

function readActivePhonesFromCSV() {
  return new Promise((resolve, reject) => {
    const activeContacts = [];
    fs.createReadStream('Export_Contacts_All_Dec_2025_4_55_PM.csv')
      .pipe(csv())
      .on('data', (row) => {
        if (row.Phone) {
          const cleaned = row.Phone.replace(/[^\d]/g, '');
          if (cleaned) {
            // Capitalize name
            let name = row.Name || '';
            name = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
            activeContacts.push({ phone: cleaned, name });
          }
        }
      })
      .on('end', () => {
        resolve(activeContacts); // Return array of {phone, name}
      })
      .on('error', reject);
  });
}

async function getAirtableRecords() {
  let allRecords = [];
  let offset = undefined;
  do {
    const params = {
      pageSize: 100,
    };
    if (offset) params.offset = offset;
    const response = await axios.get(AIRTABLE_URL, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_KEY}`,
      },
      params,
    });
    allRecords = allRecords.concat(response.data.records);
    offset = response.data.offset;
  } while (offset);
  return allRecords;
}

async function updateMemberStatus(recordId, name) {
  // Capitalize each word in the name
  const capName = name
    ? name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
    : '';
  await axios.patch(`${AIRTABLE_URL}/${recordId}`, {
    fields: {
      'Member Status': 'Active',
      'Name': capName,
      'Approval Status': true,
      'Processed': true,
      'Supervisor Approval Required': true,
      'Supervisor Decision': 'Approved',
    },
  }, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
  // Add a delay to avoid rate limiting
  await new Promise(resolve => setTimeout(resolve, 300));
}

(async () => {
  try {
    const activeContacts = await readActivePhonesFromCSV();
    console.log(`Loaded ${activeContacts.length} truly active contacts from CSV.`);
    const records = await getAirtableRecords();
    let updated = 0;
    const phoneMap = new Map(activeContacts.map(c => [c.phone, c.name]));
    for (const record of records) {
      const airtablePhone = record.fields['Phone Number'] ? record.fields['Phone Number'].replace(/[^\d]/g, '') : '';
      if (phoneMap.has(airtablePhone)) {
        // Update both Member Status and Name (capitalized)
        await updateMemberStatus(record.id, phoneMap.get(airtablePhone));
        updated++;
        console.log(`Updated Member Status to Active and Name for: ${phoneMap.get(airtablePhone)}`);
      }
    }
    console.log(`Bulk update complete. ${updated} records updated.`);
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
