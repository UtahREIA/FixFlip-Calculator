// API endpoint for BRRRR Calculator phone verification (Airtable)
// Place in: BRRRR Calculator/api/check-phone-brrrr.js

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: "Phone required" });
  }

  // Airtable config for BRRRR Calculator
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY_BRRRR;
  const BASE_ID = process.env.AIRTABLE_BASE_ID_BRRRR;
  const TABLE_NAME = "Verifications";

  if (!AIRTABLE_API_KEY || !BASE_ID) {
    return res.status(500).json({ error: "Missing Airtable credentials for BRRRR" });
  }

  // Use the exact field name for phone lookup
  const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/${TABLE_NAME}?filterByFormula={Phone Number}='${phone}'`;

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
      "Content-Type": "application/json"
    },
  });

  const data = await response.json();

  if (data.records && data.records.length > 0) {
    const record = data.records[0].fields;
    // Use exact field names from Airtable
    const approvalStatus = record["Approval Status"] || "";
    const memberStatus = record["Member Status"] || "";

    // If approved and Active, grant full access
    if (approvalStatus === "Approved" && memberStatus === "Active") {
      return res.status(200).json({
        valid: true,
        status: "Active",
        trial: false,
        trialDaysLeft: 0
      });
    }

    // Otherwise, grant 30-day trial
    // Calculate days left if First Access Date exists
    let trialDaysLeft = 30;
    if (record["First Access Date"]) {
      const start = new Date(record["First Access Date"]);
      const now = new Date();
      const diff = Math.floor((now - start) / (1000 * 60 * 60 * 24));
      trialDaysLeft = Math.max(30 - diff, 0);
    }
    return res.status(200).json({
      valid: true,
      status: "Trial",
      trial: true,
      trialDaysLeft
    });
  }

  // No record found: start trial now
  return res.status(200).json({
    valid: true,
    status: "Trial",
    trial: true,
    trialDaysLeft: 30
  });
}
