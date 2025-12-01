/**
 * Airtable Backend for Phone Verification
 * 
 * This example uses Airtable to store and check member phone numbers.
 * You'll need:
 * 1. Airtable API Key (from account settings)
 * 2. Base ID (from your Airtable base URL)
 * 3. Table name (e.g., "Members")
 * 
 * Airtable Table Structure (suggested):
 * - Phone (Phone field type) - normalized format like +18015551234
 * - Name (Single line text)
 * - Status (Single select: Active, Inactive, Pending)
 * - Member Since (Date)
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

// Airtable Configuration
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || 'YOUR_AIRTABLE_API_KEY_HERE';
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'YOUR_BASE_ID_HERE';
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Members';

// Helper: Normalize phone
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '').replace(/^1/, '');
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

// Check if phone exists in Airtable and member is active
async function isAirtableMember(phone) {
  const normalized = normalizePhone(phone);

  try {
    // Airtable API: filter by phone field
    const filterFormula = `{Phone} = '${normalized}'`;
    const url = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}?filterByFormula=${encodeURIComponent(filterFormula)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Airtable API error:', response.status, await response.text());
      return false;
    }

    const data = await response.json();

    if (!data.records || data.records.length === 0) {
      return false; // Phone not found
    }

    const record = data.records[0];
    
    // Check if member status is "Active"
    const status = record.fields.Status || '';
    
    if (status.toLowerCase() === 'active') {
      return true;
    }

    return false; // Found but not active

  } catch (error) {
    console.error('Airtable member check failed:', error);
    return false;
  }
}

// API endpoint
app.post('/api/check-phone', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ valid: false, error: 'Invalid phone format' });
    }

    const isMember = await isAirtableMember(phone);

    // Optional: Log access attempts
    if (isMember) {
      console.log(`✅ Access granted for: ${phone}`);
    } else {
      console.log(`❌ Access denied for: ${phone}`);
    }

    return res.json({ valid: isMember });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔐 Phone gate server running on port ${PORT}`);
  console.log(`📊 Ready to verify UTAH REIA members via Airtable`);
});

/**
 * AIRTABLE SETUP INSTRUCTIONS:
 * 
 * 1. Create Airtable Base:
 *    - Go to airtable.com
 *    - Create new base called "UTAH REIA Members"
 * 
 * 2. Add Fields:
 *    - Phone (Phone field) - IMPORTANT: Store in format +18015551234
 *    - Name (Single line text)
 *    - Status (Single select with options: Active, Inactive, Pending)
 *    - Member Since (Date)
 *    - Email (optional)
 * 
 * 3. Import your members:
 *    - Export from GoHighLevel or wherever you have them
 *    - Format phone numbers consistently
 *    - Set Status to "Active" for valid members
 * 
 * 4. Get API credentials:
 *    - Go to airtable.com/account
 *    - Generate personal access token (or use legacy API key)
 *    - Get Base ID from base URL: https://airtable.com/appXXXXXXXXXXXXXX
 * 
 * 5. Deploy this backend:
 *    - Vercel/Netlify serverless function (recommended)
 *    - Or run as standalone Node server
 * 
 * DEPLOYMENT OPTIONS:
 * 
 * 1. Vercel Serverless:
 *    - Create /api/check-phone.js with this logic
 *    - Add env vars in Vercel dashboard
 * 
 * 2. Netlify Function:
 *    - Create /netlify/functions/check-phone.js
 *    - Add env vars in Netlify
 * 
 * 3. Cloudflare Workers (advanced):
 *    - Port to CF Workers syntax
 *    - Store API keys as secrets
 */

/**
 * PHONE NORMALIZATION TIP:
 * 
 * When importing to Airtable, use this formula or script to normalize phones:
 * 
 * CONCATENATE("+1", SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone}, "(", ""), ")", ""), "-", ""), " ", ""))
 * 
 * This converts formats like:
 * - (801) 555-1234 → +18015551234
 * - 801-555-1234 → +18015551234
 * - 8015551234 → +18015551234
 */
