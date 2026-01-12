// API endpoint for BRRRR Calculator phone verification (Airtable)
// Vercel Serverless Function: /api/check-phone-brrrr

import axios from "axios";

export default async function handler(req, res) {
  // ---------------------------
  // CORS (always set)
  // ---------------------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
  res.setHeader("Access-Control-Max-Age", "86400"); // cache preflight 24h

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({ valid: false, error: "Method not allowed" });
  }

  // ---------------------------
  // Parse + validate input
  // ---------------------------
  let body = req.body;

  // Vercel typically parses JSON body automatically, but handle string body safely too
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ valid: false, error: "Invalid JSON body" });
    }
  }

  let phone = body?.phone;
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ valid: false, error: "No phone provided" });
  }

  phone = phone.replace(/\D/g, "");
  const last10 = phone.slice(-10);

  if (!last10 || last10.length !== 10) {
    return res.status(400).json({ valid: false, error: "Phone number must contain 10 digits" });
  }

  // ---------------------------
  // Env vars
  // ---------------------------
  const AIRTABLE_KEY = process.env.AIRTABLE_API_KEY_BRRRR;
  const AIRTABLE_ID = process.env.AIRTABLE_BASE_ID_BRRRR;
  const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME_BRRRR || "Verifications";

  if (!AIRTABLE_KEY || !AIRTABLE_ID) {
    return res.status(500).json({
      valid: false,
      error: "Missing Airtable env vars (AIRTABLE_API_KEY_BRRRR or AIRTABLE_BASE_ID_BRRRR).",
    });
  }

  const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_ID}/${encodeURIComponent(
    AIRTABLE_TABLE_NAME
  )}`;

  // ---------------------------
  // Airtable filters
  // ---------------------------
  // First: approved + active members
  const filterActive =
    `AND(` +
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}', ` +
    `{Approval Status} = 'Approved', {Member Status} = 'Active')`;

  // Second: any record matching phone
  const filterAny =
    `RIGHT(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE(SUBSTITUTE({Phone Number}, '(', ''), ')', ''), '-', ''), ' ', ''), 10) = '${last10}'`;

  try {
    // 1) Active member check
    let response = await axios.get(AIRTABLE_URL, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
      params: {
        filterByFormula: filterActive,
        maxRecords: 1,
      },
    });

    let records = response?.data?.records || [];
    if (records.length > 0) {
      const record = records[0];
      return res.status(200).json({
        valid: true,
        name: record?.fields?.Name || "",
        status: "Active",
        trial: false,
      });
    }

    // 2) Any contact check
    response = await axios.get(AIRTABLE_URL, {
      headers: { Authorization: `Bearer ${AIRTABLE_KEY}` },
      params: {
        filterByFormula: filterAny,
        maxRecords: 1,
      },
    });

    records = response?.data?.records || [];
    if (records.length === 0) {
      // No such contact
      return res.status(200).json({ valid: false });
    }

    const record = records[0];
    const recordId = record.id;
    const fields = record.fields || {};

    const name = fields.Name || "";
    const firstAccess = fields["First Access Date"];
    const memberStatus = String(fields["Member Status"] || "").toLowerCase();

    // If Member Status is active, grant unlimited access
    if (memberStatus === "active") {
      return res.status(200).json({ valid: true, name, status: "Active", trial: false });
    }

    // Trial logic
    const today = new Date();

    let trialStart = firstAccess;
    let trialDaysLeft = 0;
    let trialExpired = false;

    if (!firstAccess) {
      const isoToday = today.toISOString().split("T")[0];

      await axios.patch(
        `${AIRTABLE_URL}/${recordId}`,
        { fields: { "First Access Date": isoToday } },
        {
          headers: {
            Authorization: `Bearer ${AIRTABLE_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      trialStart = isoToday;
      trialDaysLeft = 30;
    } else {
      const start = new Date(firstAccess);
      const diff = Math.floor((today - start) / (1000 * 60 * 60 * 24));

      trialDaysLeft = 30 - diff;
      if (trialDaysLeft < 0) trialDaysLeft = 0;

      // If diff is 31+ days, trial is expired
      trialExpired = diff > 30;
    }

    if (!trialExpired) {
      return res.status(200).json({
        valid: true,
        name,
        status: "Trial",
        trial: true,
        trialDaysLeft,
        trialStart,
      });
    }

    return res.status(200).json({
      valid: false,
      name,
      status: "Trial Expired",
      trial: true,
      trialDaysLeft: 0,
      trialStart,
    });
  } catch (err) {
    // More useful error output
    const airtableData = err?.response?.data;
    const message = err?.message || "Unknown error";

    console.error("BRRRR verification error:", message, airtableData);

    return res.status(500).json({
      valid: false,
      error: message,
      airtable: airtableData,
    });
  }
}
