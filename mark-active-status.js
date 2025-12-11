// Node.js script to mark Status as 'Active' in ghl_contacts.csv for contacts whose phone number matches Export_Contacts_All_Dec_2025_4_55_PM.csv
// Instructions:
// 1. Install dependencies: npm install csv-parser csv-writer
// 2. Place both CSV files in the workspace
// 3. Run: node mark-active-status.js

const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const MAIN_CSV = 'ghl_contacts.csv';
const ACTIVE_CSV = 'Export_Contacts_All_Dec_2025_4_55_PM.csv';
const OUTPUT_CSV = 'ghl_contacts_with_status.csv';

function cleanPhone(phone) {
  return phone ? phone.replace(/[^\d]/g, '') : '';
}

async function getActivePhones() {
  return new Promise((resolve, reject) => {
    const activePhones = new Set();
    fs.createReadStream(ACTIVE_CSV)
      .pipe(csv())
      .on('data', (row) => {
        if (row.Phone) {
          activePhones.add(cleanPhone(row.Phone));
        }
      })
      .on('end', () => resolve(activePhones))
      .on('error', reject);
  });
}

async function processMainCsv(activePhones) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(MAIN_CSV)
      .pipe(csv())
      .on('data', (row) => {
        const phoneClean = cleanPhone(row.Phone);
        row.Status = activePhones.has(phoneClean) ? 'Active' : '';
        results.push(row);
      })
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

async function writeCsv(rows) {
  const headers = Object.keys(rows[0]).map(h => ({ id: h, title: h }));
  const csvWriter = createCsvWriter({ path: OUTPUT_CSV, header: headers });
  await csvWriter.writeRecords(rows);
  console.log(`Updated file written to ${OUTPUT_CSV}`);
}

(async () => {
  try {
    const activePhones = await getActivePhones();
    const updatedRows = await processMainCsv(activePhones);
    await writeCsv(updatedRows);
  } catch (err) {
    console.error('Error:', err.message);
  }
})();
