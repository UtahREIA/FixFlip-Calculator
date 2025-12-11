// Node.js script to bulk update "Approved Status" for active members in Airtable
// Instructions:
// 1. Install dependencies: npm install axios dotenv
// 2. Ensure your .env file has AIRTABLE_KEY, AIRTABLE_ID, AIRTABLE_TABLE_NAME
// 3. Run: node airtable-approve-active.js

require('dotenv').config({ path: './phone-api/.env' });
const axios = require('axios');

const AIRTABLE_KEY = process.env.AIRTABLE_KEY;
const AIRTABLE_ID = process.env.AIRTABLE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;

async function getActiveMembers() {
  const response = await axios.get(AIRTABLE_URL, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
    },
    params: {
      filterByFormula: "{Approval Status}!='true'",
      maxRecords: 1000,
    },
  });
    let allRecords = [];
    let offset = undefined;
    do {
      const params = {
        filterByFormula: "AND({Member Status}='Active', {Approval Status}!=TRUE())",
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

async function updateApprovedStatus(recordId) {
  await axios.patch(`${AIRTABLE_URL}/${recordId}`, {
    fields: {
      "Approval Status": true,
    },
  }, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_KEY}`,
      'Content-Type': 'application/json',
    },
  });
}

(async () => {
  try {
    const activeMembers = await getActiveMembers();
    console.log(`Found ${activeMembers.length} active members.`);
    for (const member of activeMembers) {
      await updateApprovedStatus(member.id);
      console.log(`Updated Approved Status for: ${member.fields.Name || member.id}`);
    }
    console.log('Bulk update complete.');
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
})();
