/**
 * Vercel Serverless Function for Phone Verification via GoHighLevel
 */

// Helper: Normalize phone to match GHL format
function normalizePhone(raw) {
  const digits = String(raw || '').replace(/[^\d]/g, '').replace(/^1/, '');
  // GHL typically stores as +1XXXXXXXXXX
  return digits.length === 10 ? `+1${digits}` : `+${digits}`;
}

// Check if contact is a member in GHL
async function isGHLMember(phone) {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
  // Support multiple tags separated by commas: "new member,premium member,vip"
  const ALLOWED_TAGS = (process.env.ALLOWED_TAGS || 'new member')
    .split(',')
    .map(tag => tag.trim().toLowerCase());
  const GHL_API_BASE = 'https://services.leadconnectorhq.com';

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
      console.log(`❌ Phone not found in GHL: ${normalized}`);
      return false;
    }

    const contact = data.contacts[0];

    // Check if contact has ANY of the allowed tags
    const hasAllowedTag = contact.tags && contact.tags.some(tag => 
      ALLOWED_TAGS.includes(tag.toLowerCase())
    );

    if (hasAllowedTag) {
      const matchedTag = contact.tags.find(tag => ALLOWED_TAGS.includes(tag.toLowerCase()));
      console.log(`✅ Member found with tag "${matchedTag}": ${contact.firstName || ''} ${contact.lastName || ''} (${normalized})`);
      return true;
    }

    console.log(`❌ Contact found but doesn't have allowed tags. Has: ${contact.tags?.join(', ') || 'none'}`);
    return false;

  } catch (error) {
    console.error('GHL member check failed:', error);
    return false;
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  try {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ valid: false, error: 'Invalid phone format' });
    }

    const isMember = await isGHLMember(phone);

    return res.status(200).json({ valid: isMember });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
