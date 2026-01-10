// Test script to verify GHL API key
// Usage: node test-ghl-api.js

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const API_KEY = process.env.GHL_API_KEY; // Set this in your environment or replace with your key
const LOCATION_ID = process.env.GHL_LOCATION_ID; // Set this in your environment or replace with your location id

async function testGHLKey() {
  const baseUrl = "https://services.leadconnectorhq.com";
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${API_KEY}`,
    Version: "2021-07-28"
  };

  // Try to fetch contacts (should return 200 if key is valid)
  const resp = await fetch(`${baseUrl}/contacts/?locationId=${LOCATION_ID}&limit=1`, {
    method: "GET",
    headers
  });
  const text = await resp.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  console.log("Status:", resp.status);
  console.log("Response:", data);
}

testGHLKey().catch(console.error);
