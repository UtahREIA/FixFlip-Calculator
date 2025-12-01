/**
 * GoHighLevel Backend for Phone Verification
 * 
 * This example uses GoHighLevel API to check if a phone number belongs to a member.
 * You'll need:
 * 1. GHL API Key (from Settings > API > Access)
 * 2. Location ID (your GHL sub-account)
 * 3. A custom field or tag that identifies "members" (e.g., tag: "Member" or custom field: membership_status = "active")
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';

const app = express();
app.use(cors());
app.use(express.json());

// GoHighLevel Configuration
const GHL_API_KEY = process.env.GHL_API_KEY || 'pit-1cb0539d-1845-4229-b8c8-c4b515fc7b31';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || 'DNirEjy0ejVwbHsaBYrn';
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const MEMBER_TAG = 'new member'; // Tag that identifies members

// Helper: Normalize phone to match GHL format
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '').replace(/^1/, '');
  // GHL typically stores as +1XXXXXXXXXX
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

// Check if contact is a member in GHL
async function isGHLMember(phone) {
  const normalized = normalizePhone(phone);

  try {
    // Search for contact by phone
    const searchUrl = `${GHL_API_BASE}/contacts/?locationId=${GHL_LOCATION_ID}&query=${encodeURIComponent(normalized)}`;
    
    const response = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('GHL API error:', response.status, await response.text());
      return false;
    }

    const data = await response.json();
    
    if (!data.contacts || data.contacts.length === 0) {
      return false; // Phone not found
    }

    const contact = data.contacts[0];

    // Check if contact has the "new member" tag
    const hasMemberTag = contact.tags && contact.tags.some(tag => 
      tag.toLowerCase() === MEMBER_TAG.toLowerCase()
    );

    if (hasMemberTag) {
      console.log(`✅ Member found: ${contact.firstName || ''} ${contact.lastName || ''} (${normalized})`);
      return true;
    }

    console.log(`❌ Contact found but not a member: ${normalized}`);
    return false; // Not a member

  } catch (error) {
    console.error('GHL member check failed:', error);
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

    const isMember = await isGHLMember(phone);

    return res.json({ valid: isMember });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🔐 Phone gate server running on port ${PORT}`);
  console.log(`📞 Ready to verify UTAH REIA members via GoHighLevel`);
});

/**
 * DEPLOYMENT OPTIONS:
 * 
 * 1. Vercel Serverless Function:
 *    - Create /api/check-phone.js with same logic
 *    - Set GHL_API_KEY and GHL_LOCATION_ID as environment variables
 * 
 * 2. Netlify Function:
 *    - Create /netlify/functions/check-phone.js
 *    - Same env vars in Netlify dashboard
 * 
 * 3. Your own server:
 *    - Run this file: node backend-gohighlevel.js
 *    - Set environment variables
 * 
 * 4. GoHighLevel Webhook (advanced):
 *    - Create a GHL workflow that receives phone via webhook
 *    - Workflow checks if contact exists + is member
 *    - Returns JSON response
 */
