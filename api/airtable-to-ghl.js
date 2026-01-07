// /api/airtable-to-ghl.js

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const {
      phone,
      email,
      name,
      calculator = "Fix & Flip", // default
      firstAccessAt // optional timestamp from Airtable
    } = req.body || {};

    const normalizedPhone = normalizePhone(phone);

    if (!email && !normalizedPhone) {
      return res.status(400).json({ error: "Missing email or phone" });
    }

    // --- REQUIRED ENV VARS ---
    const TOKEN = process.env.GHL_TOKEN;                 // OAuth/private integration token
    const LOCATION_ID = process.env.GHL_LOCATION_ID;     // locationId
    const CF_CALC_USER_ID = process.env.CF_CALC_USER_ID; // custom field ID to mark user (checkbox/true-false)
    // Optional:
    const CF_CALC_NAME_ID = process.env.CF_CALC_NAME_ID; // e.g. multi-select field storing "Fix & Flip"
    const CF_FIRST_ACCESS_ID = process.env.CF_FIRST_ACCESS_ID; // date field

    if (!TOKEN || !LOCATION_ID || !CF_CALC_USER_ID) {
      return res.status(500).json({
        error: "Missing env vars",
        missing: {
          GHL_TOKEN: !TOKEN,
          GHL_LOCATION_ID: !LOCATION_ID,
          CF_CALC_USER_ID: !CF_CALC_USER_ID
        }
      });
    }

    const baseUrl = "https://services.leadconnectorhq.com";
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${TOKEN}`,
      Version: "2021-07-28"
    };

    // 1) Find contact (search)
    // The search endpoint can vary by account; safest is: upsert, then use returned contact.
    // We'll do upsert because it solves "contact not found".
    const upsertPayload = {
      locationId: LOCATION_ID,
      ...(email ? { email } : {}),
      ...(normalizedPhone ? { phone: normalizedPhone } : {}),
      ...(name ? { name } : {})
    };

    const upsertResp = await fetch(`${baseUrl}/contacts/upsert`, {
      method: "POST",
      headers,
      body: JSON.stringify(upsertPayload)
    });

    const upsertText = await upsertResp.text();
    let upsertData;
    try { upsertData = JSON.parse(upsertText); } catch { upsertData = { raw: upsertText }; }

    if (!upsertResp.ok) {
      return res.status(502).json({ error: "GHL upsert failed", details: upsertData });
    }

    const contactId =
      upsertData?.contact?.id ||
      upsertData?.contact?._id ||
      upsertData?.id;

    if (!contactId) {
      return res.status(502).json({ error: "Could not determine contactId", details: upsertData });
    }

    // 2) Build custom fields update
    const customFields = [
      { id: CF_CALC_USER_ID, value: true }
    ];

    // If you want to store the calculator name in a field:
    // - If it's a multi-select text field, pass a string like "Fix & Flip"
    // - If it's a true multi-select custom field in GHL, you typically still pass a string value that matches an option
    if (CF_CALC_NAME_ID) {
      customFields.push({ id: CF_CALC_NAME_ID, value: String(calculator) });
    }

    // Store first access time if you want
    if (CF_FIRST_ACCESS_ID) {
      customFields.push({
        id: CF_FIRST_ACCESS_ID,
        value: firstAccessAt || new Date().toISOString()
      });
    }

    const updateResp = await fetch(`${baseUrl}/contacts/${contactId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ locationId: LOCATION_ID, customFields })
    });

    const updateText = await updateResp.text();
    let updateData;
    try { updateData = JSON.parse(updateText); } catch { updateData = { raw: updateText }; }

    if (!updateResp.ok) {
      return res.status(502).json({ error: "GHL update failed", details: updateData });
    }

    return res.status(200).json({ ok: true, contactId });
  } catch (err) {
    console.error("airtable-to-ghl error:", err);
    return res.status(500).json({ error: err?.message || "Internal error" });
  }
}

function normalizePhone(raw) {
  const digits = String(raw || "").replace(/[^\d]/g, "");
  if (!digits) return "";
  // US assumption: keep last 10 digits
  return digits.length >= 10 ? digits.slice(-10) : digits;
}
