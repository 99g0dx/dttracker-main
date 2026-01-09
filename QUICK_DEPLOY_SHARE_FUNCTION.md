# Quick Deploy: Share Campaign Edge Function

## ✅ Easiest Method: Use Supabase Dashboard (No Docker Needed)

1. **Go to Supabase Dashboard**
   - Open https://app.supabase.com
   - Select your project
   - Click **"Edge Functions"** in the left sidebar

2. **Create New Function**
   - Click **"Create a new function"** or **"New Function"**
   - Function name: `share-campaign`
   - Click **"Create function"**

3. **Copy & Paste Code**
   - Open this file: `supabase/functions/share-campaign/index.ts`
   - Select ALL the code (Cmd+A)
   - Copy it (Cmd+C)
   - Go back to Supabase dashboard
   - Delete the default code in the editor
   - Paste your code (Cmd+V)

4. **Set Environment Variables** (Important!)
   - In the function editor, look for **"Settings"** or **"Secrets"** tab
   - Add these two environment variables:
     - **Name:** `SUPABASE_URL` | **Value:** `https://YOUR_PROJECT_REF.supabase.co` (get from Settings → API)
     - **Name:** `SUPABASE_SERVICE_ROLE_KEY` | **Value:** Your service role key (get from Settings → API → service_role key - starts with `eyJ...`)
   - Click **"Save"**

5. **Deploy**
   - Click the **"Deploy"** button at the top right
   - Wait for deployment to complete ✅

---

## Alternative: Use CLI (Requires Docker)

If you prefer CLI, you need to start Docker Desktop first:

1. **Start Docker Desktop** (download from docker.com if needed)

2. **Link your project** (if not already linked):
   ```bash
   cd "/Users/apple/Downloads/DTTracker UI Design Enhancements 2"
   supabase link --project-ref YOUR_PROJECT_REF
   ```
   (Find YOUR_PROJECT_REF in Supabase Dashboard → Settings → General)

3. **Set secrets**:
   ```bash
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

4. **Deploy**:
   ```bash
   supabase functions deploy share-campaign
   ```

---

## ✅ Verify It Works

After deploying, test the function:
1. Go to Edge Functions → `share-campaign` → **Logs**
2. If you have a campaign with sharing enabled, test the share link in your app

---

## 🐛 Troubleshooting

- **"Docker is not running"** → Use Option 1 (Dashboard) instead
- **"Entrypoint path does not exist"** → Make sure you're in the project directory
- **"Server configuration error"** → Check that environment variables are set correctly
