# Password Protection Setup Guide

Password protection for share links has been implemented. Follow these steps to enable it.

## Database Migration

1. **Run the migration SQL** in your Supabase SQL Editor:
   - File: `database/add_campaign_share_password.sql`
   - This adds `share_password_hash` and `share_password_protected` columns to the `campaigns` table

2. **Execute the SQL**:
   ```sql
   ALTER TABLE public.campaigns
   ADD COLUMN IF NOT EXISTS share_password_hash TEXT,
   ADD COLUMN IF NOT EXISTS share_password_protected BOOLEAN NOT NULL DEFAULT false;
   ```

## How It Works

1. **Enabling Password Protection**:
   - Open the Share Campaign modal
   - Toggle "Password Protection" to ON
   - Enter a password in the password field
   - The password is automatically saved and hashed (SHA-256)

2. **Accessing Password-Protected Links**:
   - When someone visits a password-protected share link, they'll see a password prompt
   - Enter the correct password to access the dashboard
   - The password is verified on the server side (Edge Function)

3. **Security**:
   - Passwords are hashed using SHA-256 before storage
   - Password verification happens server-side in the Edge Function
   - Password is never stored in plain text

## Features

- ✅ Password toggle in share modal
- ✅ Password input field (shown when protection is enabled)
- ✅ Password prompt on shared dashboard
- ✅ Server-side password verification
- ✅ Secure password hashing (SHA-256)

## Testing

1. Enable sharing on a campaign
2. Toggle "Password Protection" ON
3. Enter a password (e.g., "test123")
4. Copy the share link
5. Open the link in an incognito window
6. You should see a password prompt
7. Enter the correct password to access the dashboard
8. Try an incorrect password - it should show an error

## Notes

- Passwords are required to be non-empty when password protection is enabled
- Disabling password protection clears the stored password hash
- Regenerating a link preserves the password protection settings
- Password is verified on every request to the Edge Function



