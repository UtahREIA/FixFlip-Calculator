
const axios = require('axios');

const GHL_API_KEY = 'YOUR_GHL_API_KEY';
const GHL_CALC_FIELD_ID = 'access_to_calculators';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const { email, phone, calculators } = req.body;
    if (!email && !phone) {
      res.status(400).json({ error: 'Missing email or phone' });
      return;
    }
    let newCalcs = [];
    if (Array.isArray(calculators)) {
      newCalcs = calculators;
    } else if (typeof calculators === 'string') {
      newCalcs = [calculators];
    } else {
      res.status(400).json({ error: 'Missing calculators' });
      return;
    }
    // Only keep 'Fix & Flip'
    newCalcs = newCalcs.filter(c => String(c).toLowerCase().replace(/[^a-z]/g, '') === 'fixflip');
    if (newCalcs.length === 0) {
      res.status(200).json({ success: true, skipped: 'No Fix & Flip calculator in request.' });
      return;
    }

    // Find contact in GHL by email or phone
    const findContactUrl = `https://rest.gohighlevel.com/v1/contacts/search`;
    const searchPayload = {
      query: email || phone,
      limit: 1
    };
    const searchResp = await axios.post(findContactUrl, searchPayload, {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
    });
    const contact = searchResp.data.contacts?.[0];
    if (!contact) {
      res.status(404).json({ error: 'Contact not found in GHL' });
      return;
    }

    // Get current calculators (array of strings)
    let currentCalcs = [];
    if (contact.customField && contact.customField[GHL_CALC_FIELD_ID]) {
      const val = contact.customField[GHL_CALC_FIELD_ID];
      if (Array.isArray(val)) {
        currentCalcs = val;
      } else if (typeof val === 'string') {
        currentCalcs = val.split(',').map(s => s.trim()).filter(Boolean);
      }
    }

    // Merge and dedupe
    const allCalcs = Array.from(new Set([...currentCalcs, ...newCalcs]));

    // Update the custom field
    const updateUrl = `https://rest.gohighlevel.com/v1/contacts/${contact.id}`;
    const updatePayload = {
      customField: {
        [GHL_CALC_FIELD_ID]: allCalcs
      }
    };
    await axios.put(updateUrl, updatePayload, {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
    });

    res.json({ success: true, updated: allCalcs });
  } catch (err) {
    console.error('Webhook error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Internal error', details: err.response?.data || err.message });
  }
};
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
