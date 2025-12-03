# Fix & Flip Calculator - GHL Workflow Setup Guide

This version (`fixflip2.html`) uses **GoHighLevel Automation Workflow + Database** approach for phone verification.

---

## Architecture Overview

**Flow:**

1. User enters phone → Submits to GHL webhook
2. GHL workflow triggers → Checks if contact has "new member" tag
3. Workflow writes result to database (SQL/Google Sheets/Airtable)
4. Calculator polls database for approval
5. If approved → Unlock calculator

**Why this approach:**

- Leverages GHL automation workflows (per your boss's preference)
- Allows for marketing customization (workflow can trigger follow-ups, notifications, etc.)
- Database stores verification history for analytics
- More flexible for future enhancements

---

## Setup Steps

### 1. Choose Your Database

Your boss mentioned using **Google Cloud SQL** or you can use:

- **Airtable** (easiest, no SQL knowledge needed)
- **Google Sheets** (free, simple API)
- **Google Cloud SQL** (professional, scalable)

**Recommended: Airtable for simplicity**

---

### 2. Set Up Database

#### Option A: Airtable (Recommended)

1. Create base: "UTAH REIA Calculator Access"
2. Create table: "Verifications"
3. Add fields:

   - `phone` (Phone number type) - Primary field
   - `approved` (Checkbox) - true/false
   - `processed` (Checkbox) - true/false
   - `timestamp` (Date)
   - `name` (Single line text) - Optional
   - `contact_id` (Single line text) - Optional GHL contact ID

4. Get your Airtable credentials:
   - Personal Access Token: https://airtable.com/account
   - Base ID: From URL `https://airtable.com/appXXXXXXXXXXXXXX`
   - Table name: "Verifications"

#### Option B: Google Sheets

1. Create spreadsheet: "Calculator Verifications"
2. Add columns: `phone`, `approved`, `processed`, `timestamp`
3. Deploy as web app or use Sheets API

#### Option C: Google Cloud SQL

1. Create MySQL/PostgreSQL instance
2. Create table:
   ```sql
   CREATE TABLE verifications (
     id INT AUTO_INCREMENT PRIMARY KEY,
     phone VARCHAR(20) UNIQUE,
     approved BOOLEAN DEFAULT FALSE,
     processed BOOLEAN DEFAULT FALSE,
     timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
   );
   ```

---

### 3. Create GHL Automation Workflow

**In GoHighLevel:**

1. Go to **Automation** → **Workflows**
2. Click **Create Workflow**
3. Name: "Calculator Phone Verification"

**Workflow Steps:**

**A. Trigger: Webhook**

- Add webhook trigger
- Copy webhook URL (you'll use this in fixflip2.html)
- Expected data: `{ "phone": "8015551234" }`

**B. Action: Find Contact**

- Search contacts by phone number
- Use webhook phone value: `{{trigger.phone}}`

**C. Condition: Check Member Tag**

- If contact found AND has tag "new member" → Go to YES branch
- Otherwise → Go to NO branch

**D. YES Branch: Approve**

- Action: HTTP Request (to update database)
- Method: POST
- URL: Your database API endpoint
- Body:
  ```json
  {
    "phone": "{{trigger.phone}}",
    "approved": true,
    "processed": true,
    "name": "{{contact.firstName}} {{contact.lastName}}",
    "contact_id": "{{contact.id}}"
  }
  ```

**E. NO Branch: Deny**

- Action: HTTP Request (to update database)
- Body:
  ```json
  {
    "phone": "{{trigger.phone}}",
    "approved": false,
    "processed": true
  }
  ```

**Optional Marketing Actions:**

- Send SMS to member: "Welcome! Your calculator access has been approved."
- Add tag: "Calculator User"
- Update custom field: "Last Calculator Access" = today
- Trigger follow-up sequence

---

### 4. Create Database API Endpoints

You need two endpoints:

#### Endpoint 1: Write Approval (called by GHL workflow)

**POST** `/api/verify-phone`

```javascript
// Receives data from GHL workflow and saves to database
{
  "phone": "8015551234",
  "approved": true,
  "processed": true
}
```

#### Endpoint 2: Check Approval (called by calculator)

**GET** `/api/check-approval?phone=8015551234`

```javascript
// Returns current approval status
{
  "processed": true,
  "approved": true
}
```

**Deploy these to Vercel** (similar to how we deployed the direct API version).

---

### 5. Create Vercel API Functions

Create two files in your `api/` folder:

**`api/verify-phone.js`** (receives data from GHL workflow):

```javascript
// Saves verification result to database
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, approved, processed, name, contact_id } = req.body;

  // TODO: Save to your database (Airtable/SQL/Sheets)
  // Example for Airtable:
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  const response = await fetch(
    `https://api.airtable.com/v0/${BASE_ID}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${AIRTABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fields: {
          phone,
          approved,
          processed,
          name,
          contact_id,
          timestamp: new Date().toISOString(),
        },
      }),
    }
  );

  return res.status(200).json({ success: true });
}
```

**`api/check-approval.js`** (calculator polls this):

```javascript
// Checks if phone has been approved
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { phone } = req.query;

  if (!phone) {
    return res.status(400).json({ error: "Phone required" });
  }

  // TODO: Query your database
  // Example for Airtable:
  const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
  const BASE_ID = process.env.AIRTABLE_BASE_ID;

  const searchUrl = `https://api.airtable.com/v0/${BASE_ID}/Verifications?filterByFormula={phone}="${phone}"`;

  const response = await fetch(searchUrl, {
    headers: {
      Authorization: `Bearer ${AIRTABLE_API_KEY}`,
    },
  });

  const data = await response.json();

  if (data.records && data.records.length > 0) {
    const record = data.records[0].fields;
    return res.status(200).json({
      processed: record.processed || false,
      approved: record.approved || false,
    });
  }

  // No record yet (workflow hasn't processed)
  return res.status(200).json({
    processed: false,
    approved: false,
  });
}
```

---

### 6. Update fixflip2.html URLs

In `fixflip2.html`, update these lines (around line 1933):

```javascript
const GHL_WEBHOOK_URL =
  "https://your-location.gohighlevel.com/webhook/YOUR_WEBHOOK_ID";
const DATABASE_CHECK_URL =
  "https://fix-flip-calculator-delta.vercel.app/api/check-approval";
```

Replace:

- `GHL_WEBHOOK_URL` with your GHL workflow webhook URL
- `DATABASE_CHECK_URL` with your Vercel API endpoint

---

### 7. Deploy to Vercel

```bash
cd c:\Users\david\Downloads\FixFlip-Calculator
git add api/verify-phone.js api/check-approval.js fixflip2.html WORKFLOW_SETUP.md
git commit -m "Add workflow-based verification version"
git push
```

Set environment variables in Vercel:

- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`

---

## Testing

1. **Test GHL Webhook:**

   ```bash
   curl -X POST https://your-ghl-webhook-url \
     -H "Content-Type: application/json" \
     -d '{"phone":"8015551234"}'
   ```

2. **Check Workflow Runs:**

   - Go to GHL → Automation → Workflows
   - Check workflow history
   - Verify it found contact and updated database

3. **Test Database API:**

   ```bash
   curl https://fix-flip-calculator-delta.vercel.app/api/check-approval?phone=8015551234
   ```

   Should return: `{"processed":true,"approved":true}`

4. **Test Calculator:**
   - Open fixflip2.html
   - Enter member phone
   - Should see "Verifying..." for 2-5 seconds
   - Calculator unlocks if approved

---

## Comparison: Direct API vs Workflow

| Feature           | Direct API (fixflip.html) | Workflow (fixflip2.html)                       |
| ----------------- | ------------------------- | ---------------------------------------------- |
| **Speed**         | <1 second                 | 2-10 seconds                                   |
| **Complexity**    | Simple (1 API call)       | Complex (webhook → workflow → database → poll) |
| **Marketing**     | Limited                   | Flexible (workflow can trigger campaigns)      |
| **Database**      | Optional                  | Required                                       |
| **Analytics**     | Basic logs                | Full history in database                       |
| **Customization** | Code changes needed       | Workflow visual editor                         |
| **Maintenance**   | Low                       | Medium                                         |

---

## Marketing Enhancements (Your Boss Will Love These)

Since you're using workflows, you can now:

1. **Track Calculator Usage:**

   - See which members use calculator most
   - Analyze usage patterns

2. **Automated Follow-ups:**

   - Send SMS after calculator access: "Need help analyzing your deal?"
   - Email with resources after 24 hours
   - Re-engagement campaigns for inactive users

3. **Lead Scoring:**

   - Contacts who use calculator = hot leads
   - Trigger different sequences based on usage

4. **A/B Testing:**

   - Easy to test different approval logic
   - Test different follow-up messages

5. **Reporting:**
   - Dashboard showing calculator access requests
   - Member vs non-member attempts
   - Conversion tracking

---

## Troubleshooting

**"Verification taking too long":**

- Check GHL workflow is active
- Verify webhook URL is correct
- Check database API is responding

**"Phone not recognized" but should be:**

- Check GHL workflow found the contact
- Verify "new member" tag exists
- Check database was updated

**"Failed to submit":**

- Verify GHL webhook URL is correct
- Check CORS settings on database API

---

## Next Steps

1. Set up database (Airtable recommended)
2. Create GHL workflow with webhook trigger
3. Create Vercel API endpoints
4. Update fixflip2.html URLs
5. Test with real member phone
6. Add marketing automation steps to workflow
7. Build usage dashboard

---

**Note:** Both versions (fixflip.html and fixflip2.html) will work. This workflow version provides more flexibility for marketing campaigns as your boss suggested, while the direct API version is faster and simpler for pure verification.
