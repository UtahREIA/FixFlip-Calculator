// Node.js script to fetch GHL contacts and save as CSV for Airtable import
// Instructions:
// 1. Install dependencies: npm install axios json2csv
// 2. Replace YOUR_API_KEY with your actual GHL API key
// 3. Run: node fetch-ghl-contacts.js

const axios = require('axios');
const { Parser } = require('json2csv');
const fs = require('fs');

const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJsb2NhdGlvbl9pZCI6IkROaXJFankwZWpWd2JIc2FCWXJuIiwidmVyc2lvbiI6MSwiaWF0IjoxNzQ2NTY4NTU1OTU0LCJzdWIiOiJaZjFqUFlJU3BJR1ZJOHBUM3dRZSJ9.C78SlwHKKwwvF-A5o9OGO4KEQZUMXGwsSecuTJ45S24'; // <-- Replace with your GHL API key
const ENDPOINT = 'https://rest.gohighlevel.com/v1/contacts/';

async function fetchContacts() {
  try {
    let allContacts = [];
    let page = 1;
    let hasMore = true;
    while (hasMore) {
      const response = await axios.get(ENDPOINT, {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
        },
        params: {
          limit: 100,
          page,
        },
      });
      const contacts = response.data.contacts || [];
      allContacts = allContacts.concat(contacts);
      console.log(`Fetched page ${page}, contacts:`, contacts.length);
      hasMore = contacts.length === 100;
      page++;
    }
    console.log('Total contacts fetched:', allContacts.length);
    return allContacts;
  } catch (error) {
    console.error('Error fetching contacts:', error.response?.data || error.message);
    return [];
  }
}

function saveContactsToCSV(contacts) {
  // Map contacts to only include name and phone fields
  const mapped = contacts.map(c => ({
    Name: c.firstName + ' ' + (c.lastName || ''),
    Phone: c.phone,
    Email: c.email,
    ContactID: c.id,
  }));
  const parser = new Parser({ fields: ['Name', 'Phone', 'Email', 'ContactID'] });
  const csv = parser.parse(mapped);
  fs.writeFileSync('ghl_contacts.csv', csv);
  console.log('Saved ghl_contacts.csv');
}

(async () => {
  const contacts = await fetchContacts();
  saveContactsToCSV(contacts);
})();
