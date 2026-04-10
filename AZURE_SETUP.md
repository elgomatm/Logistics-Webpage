# Azure AD Setup (One-Time, ~2 minutes)

You only need to do this once. It registers the app's login redirect URL in Microsoft's system so the sign-in button works.

---

## Steps (takes about 2 minutes)

1. Go to **[portal.azure.com](https://portal.azure.com)** and sign in with your `@theexoticsnetwork.com` account.

2. In the search bar at the top, type **"App registrations"** and click it.

3. You should see **TEN Document Studio** (or whatever you named the app when you created it). Click on it.
   - If you don't see it, click **"New registration"** and create one:
     - Name: `TEN Document Studio`
     - Supported account types: **Accounts in this organizational directory only**
     - Redirect URI: leave blank for now, we'll add it next

4. In the left sidebar, click **"Authentication"**.

5. Under **"Platform configurations"**, click **"Add a platform"** → choose **"Mobile and desktop applications"**.

6. Under **"Custom redirect URIs"**, paste this exactly:
   ```
   http://localhost:49152/auth/callback
   ```

7. Click **"Configure"**, then **"Save"** at the top.

8. In the left sidebar, click **"Overview"** and confirm:
   - **Application (client) ID** = `76dd3554-5359-4af9-bbf7-2af4979f9e46`
   - **Directory (tenant) ID** = `af0a2e75-ec1a-44be-8dd3-ddcd754e17da`

---

## If the App Registration Doesn't Exist Yet

If you need to create it from scratch:

1. **New registration**:
   - Name: `TEN Document Studio`
   - Supported account types: `Accounts in this organizational directory only (TEN only)`

2. After creating it, note the **Client ID** and **Tenant ID** shown on the Overview page.
   - Update `electron/auth.js` lines 18–19 if these differ from what's already there.

3. Go to **Authentication** → **Add a platform** → **Mobile and desktop applications** → add the custom redirect URI: `http://localhost:49152/auth/callback`

4. Go to **API permissions** → **Add a permission** → **Microsoft Graph** → **Delegated** → add:
   - `User.Read`
   - `openid`
   - `profile`
   - `email`
   - `offline_access`

5. Click **"Grant admin consent for TEN"**.

---

That's it. Once this is done, the "Sign in with Microsoft" button in the app will work.
