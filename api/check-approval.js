/**
 * Checks if a phone number has been approved
 * This endpoint is called BY the calculator to check verification status
 */

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { phone } = req.query;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    console.log(`🔍 Checking approval for: ${phone}`);

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE = 'Verifications';

    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
      console.error('❌ Missing Airtable credentials');
      return res.status(500).json({ error: 'Database not configured' });
    }

    // Search for phone number in database
    const searchUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}?filterByFormula={Phone Number}="${phone}"`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();

    if (data.records && data.records.length > 0) {
      const record = data.records[0].fields;
      
      console.log(`✅ Found record: approved=${record['Approval Status']}, processed=${record['Processed']}`);

      return res.status(200).json({
        processed: record['Processed'] || false,
        approved: record['Approval Status'] || false
      });
    }

    // No record found (workflow hasn't processed yet)
    console.log(`⏳ No record found for ${phone}`);
    return res.status(200).json({
      processed: false,
      approved: false
    });

  } catch (error) {
    console.error('❌ Error checking approval:', error);
    return res.status(500).json({ 
      error: 'Failed to check approval',
      processed: false,
      approved: false
    });
  }
}
