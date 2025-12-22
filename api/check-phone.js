  try {
    const { phone } = req.body;

    if (!phone || phone.length < 10) {
      return res.status(400).json({ valid: false, error: 'Invalid phone format' });
    }

    let isMember = false;
    let errorDetails = null;
    try {
      isMember = await isGHLMemberAndTagCalculatorUser(phone);
    } catch (err) {
      errorDetails = err && err.message ? err.message : String(err);
      console.error('GHL tagging error:', errorDetails);
    }

    if (errorDetails) {
      return res.status(200).json({ valid: isMember, error: errorDetails });
    }
    return res.status(200).json({ valid: isMember });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ valid: false, error: error && error.message ? error.message : 'Server error' });
  }
  const url = `${GHL_API_BASE}/contacts/${contactId}/tags`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tags: [tag] })
    });
    if (!response.ok) {
      console.error('Failed to add tag:', response.status, await response.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error adding tag to contact:', error);
    return false;
  }
}

// Check if contact is a member in GHL and tag as calculator user
async function isGHLMemberAndTagCalculatorUser(phone) {
  const GHL_API_KEY = process.env.GHL_API_KEY;
  const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
  const GHL_API_BASE = 'https://services.leadconnectorhq.com';
  const CALCULATOR_USER_TAG = 'calculator user';
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
    const contactSummary = data.contacts[0];
    // Tag as calculator user
    await addTagToContact(contactSummary.id, CALCULATOR_USER_TAG);
    // Fetch full contact details to get custom fields
    const contactId = contactSummary.id;
    const detailUrl = `${GHL_API_BASE}/contacts/${contactId}`;
    const detailResponse = await fetch(detailUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Version': '2021-07-28',
        'Content-Type': 'application/json'
      }
    });
    if (!detailResponse.ok) {
      console.error('GHL contact detail error:', detailResponse.status);
      return false;
    }
    const contactDetail = await detailResponse.json();
    const contact = contactDetail.contact || contactDetail;
    // Check if contact has Status = "Active" in customFields
    // Status custom field ID is pVjzZbTLHlgbSX5IVbhc
    const statusField = contact.customFields?.find(f => f.id === 'pVjzZbTLHlgbSX5IVbhc');
    const status = statusField?.value;
    // Check if status is "Active"
    const isActive = status && status.toLowerCase() === 'active';
    if (isActive) {
      console.log(`✅ Active member found: ${contact.firstName || ''} ${contact.lastName || ''} (${normalized}) - Status: ${status}`);
      return true;
    }
    console.log(`❌ Contact found but status is not "Active". Status: ${status || 'none'}, Tags: ${contact.tags?.join(', ') || 'none'}`);
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

    const isMember = await isGHLMemberAndTagCalculatorUser(phone);
    return res.status(200).json({ valid: isMember });

  } catch (error) {
    console.error('Phone verification error:', error);
    return res.status(500).json({ valid: false, error: 'Server error' });
  }
}
