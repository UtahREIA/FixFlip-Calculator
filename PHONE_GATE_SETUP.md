# Phone Gate Setup Guide for UTAH REIA Fix & Flip Calculator

## ✅ What's Been Done

The calculator now has phone-gated access:

- Phone entry form appears first
- Calculator is hidden until phone is verified
- Session storage remembers verification (no re-entry during session)
- Clean error messages for invalid/unrecognized numbers

## 🔧 What You Need To Do

### Option 1: Use GoHighLevel (Recommended if you already have members there)

1. **Get GHL API Credentials:**

   - Log into GoHighLevel
   - Go to Settings > API > Access
   - Create API key with "contacts.readonly" permission
   - Copy your Location ID (sub-account ID)

2. **Identify Members:**

   - Decide how to filter members in GHL:
     - **Option A:** Tag members with "Member" or "Active Member"
     - **Option B:** Use custom field like `membership_status` = "active"
     - **Option C:** Use pipeline stage

3. **Deploy Backend:**

   - Use `backend-gohighlevel.js` file I created
   - Update the member check logic (lines 54-73) to match YOUR method
   - Deploy to Vercel/Netlify/your server (see deployment section below)

4. **Update Calculator:**
   - In `fixflip.html` line ~1945, change:
     ```js
     const res = await fetch('/api/check-phone', {
     ```
     To your actual backend URL:
     ```js
     const res = await fetch('https://your-backend.vercel.app/api/check-phone', {
     ```

---

### Option 2: Use Airtable (Recommended for simplicity)

1. **Create Airtable Base:**

   - Go to airtable.com
   - Create base: "UTAH REIA Members"
   - Add fields:
     - `Phone` (Phone type) - format: +18015551234
     - `Name` (Single line text)
     - `Status` (Single select: Active, Inactive, Pending)
     - `Member Since` (Date)

2. **Import Members:**

   - Export phone numbers from GoHighLevel
   - Normalize format (remove dashes, add +1 prefix)
   - Import to Airtable
   - Set `Status` = "Active" for valid members

3. **Get Airtable API Key:**

   - Go to airtable.com/account
   - Create personal access token
   - Get Base ID from URL: `https://airtable.com/appXXXXXXXXXXXXXX`
   - Table name: "Members"

4. **Deploy Backend:**

   - Use `backend-airtable.js` file I created
   - Deploy to Vercel/Netlify/your server
   - Set environment variables (see deployment)

5. **Update Calculator:**
   - Same as Option 1 step 4

---

## 🚀 Deployment Options

### Easy Option: Vercel (Free, Serverless)

1. Install Vercel CLI:

   ```bash
   npm install -g vercel
   ```

2. Create `api/check-phone.js` in your project:

   - Copy the logic from `backend-gohighlevel.js` or `backend-airtable.js`
   - Export as serverless function:

   ```js
   export default async function handler(req, res) {
     // ... your logic here
   }
   ```

3. Deploy:

   ```bash
   vercel
   ```

4. Set environment variables in Vercel dashboard:

   - `AIRTABLE_API_KEY` or `GHL_API_KEY`
   - `AIRTABLE_BASE_ID` or `GHL_LOCATION_ID`
   - `AIRTABLE_TABLE_NAME` (if Airtable)

5. Update calculator URL to: `https://your-project.vercel.app/api/check-phone`

### Alternative: Netlify Functions

Similar to Vercel, but files go in `/netlify/functions/check-phone.js`

### Alternative: Your Own Server

1. Install dependencies:

   ```bash
   npm install express cors node-fetch
   ```

2. Run:

   ```bash
   node backend-airtable.js
   ```

   or

   ```bash
   node backend-gohighlevel.js
   ```

3. Keep server running (use PM2, Docker, etc.)
4. Update calculator URL to: `http://your-server.com:3000/api/check-phone`

---

## 📱 Phone Number Format

**IMPORTANT:** Store all phones in the same format:

- Format: `+18015551234` (country code + 10 digits, no spaces/dashes)
- The frontend and backend both normalize input to this format
- Make sure your database/Airtable uses this format

**To normalize existing numbers:**

- Remove: `( ) - spaces`
- Add `+1` prefix for US numbers
- Final: `+18015551234`

---

## 🔒 Security Notes

✅ **What's Secure:**

- Phone check happens server-side (can't be bypassed)
- No member list exposed to front-end
- Session storage only stores "verified" flag (no sensitive data)

❌ **Don't Do This:**

- Don't put phone list in JavaScript (easily bypassed)
- Don't use localStorage for long-term access (users can fake it)
- Don't skip backend validation

---

## 🧪 Testing

1. **Test valid member:**

   - Enter a phone from your member list
   - Should unlock calculator immediately
   - Refresh page → should stay unlocked (session storage)

2. **Test invalid number:**

   - Enter random phone
   - Should show error: "This phone number is not recognized..."
   - Calculator stays locked

3. **Test bad format:**
   - Enter "abc" or "123"
   - Should show error: "Please enter a valid 10-digit phone number."

---

## 🎯 Next Steps

1. **Choose your backend** (GHL or Airtable)
2. **Set up credentials** (API keys, Base ID, etc.)
3. **Deploy backend** (Vercel recommended)
4. **Update calculator URL** (line ~1945 in fixflip.html)
5. **Test with real member phones**
6. **Go live!**

---

## 💡 Optional Enhancements

1. **Rate limiting:** Add rate limit to prevent brute force attempts
2. **Usage logging:** Log all access attempts to Airtable/GHL for analytics
3. **Expiring access:** Instead of session storage, use time-limited tokens
4. **Member portal:** Add "Forgot access?" link to email them a link
5. **Analytics:** Track which members use calculator most

---

## 🆘 Troubleshooting

**"Unable to verify phone number":**

- Check backend URL is correct
- Check CORS is enabled on backend
- Check API credentials are set
- Check network tab in browser DevTools

**"Phone not recognized" but it should be:**

- Check phone format in database matches normalized format
- Check member Status is "Active" (Airtable) or has correct tag (GHL)
- Check API permissions (contacts.readonly for GHL)

**Calculator shows immediately without phone gate:**

- Check that `#calcWrap` has `style="display:none"` initially (line ~125)
- Clear browser cache and sessionStorage

---

## 📞 Support

If you need help:

1. Check browser console for errors (F12)
2. Check backend logs
3. Verify API credentials
4. Test backend endpoint directly with curl/Postman

Example test with curl:

```bash
curl -X POST https://your-backend.vercel.app/api/check-phone \
  -H "Content-Type: application/json" \
  -d '{"phone":"8015551234"}'
```

Should return: `{"valid":true}` or `{"valid":false}`
