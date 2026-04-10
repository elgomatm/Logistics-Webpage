'use strict';

/**
 * TEN Document Studio — Microsoft Authentication
 *
 * PKCE loopback-redirect flow (public client, no client secret)
 * Token cache encrypted with Electron safeStorage → userData/ten_auth.dat
 * Silent refresh on every app launch; interactive login only when needed
 */

const { app, safeStorage } = require('electron');
const { PublicClientApplication, LogLevel } = require('@azure/msal-node');
const http  = require('http');
const path  = require('path');
const fs    = require('fs');
const url   = require('url');

// ── Constants ──────────────────────────────────────────────────────────────
const CLIENT_ID      = '76dd3554-5359-4af9-bbf7-2af4979f9e46';
const TENANT_ID      = 'af0a2e75-ec1a-44be-8dd3-ddcd754e17da';
const AUTHORITY      = `https://login.microsoftonline.com/${TENANT_ID}`;
const REDIRECT_PORT  = 49152;
const REDIRECT_URI   = `http://localhost:${REDIRECT_PORT}/auth/callback`;
const ALLOWED_DOMAIN = 'theexoticsnetwork.com';

const SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'User.Read',
  // Graph scopes — all delegated, user-consent only (no admin required)
  'Tasks.ReadWrite',       // Planner read/write
  'Team.ReadBasic.All',    // List user's Teams (replaces Group.Read.All)
  'Files.Read',            // OneDrive storage info
  'User.ReadBasic.All',    // Resolve assignee names (basic profile, no admin needed)
];

// ── Token cache persistence ────────────────────────────────────────────────
function getCachePath() {
  return path.join(app.getPath('userData'), 'ten_auth.dat');
}

function readCache() {
  const cachePath = getCachePath();
  if (!fs.existsSync(cachePath)) return null;
  try {
    const encrypted = fs.readFileSync(cachePath);
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(encrypted);
    }
    // Fallback: plain JSON (dev environments without OS keychain)
    return encrypted.toString('utf8');
  } catch {
    return null;
  }
}

function writeCache(data) {
  const cachePath = getCachePath();
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(data);
      fs.writeFileSync(cachePath, encrypted);
    } else {
      fs.writeFileSync(cachePath, data, 'utf8');
    }
  } catch (err) {
    console.error('[auth] Failed to persist token cache:', err.message);
  }
}

function clearCache() {
  const cachePath = getCachePath();
  try { fs.unlinkSync(cachePath); } catch {}
}

// ── MSAL plugin: custom cache plugin ──────────────────────────────────────
const cachePlugin = {
  beforeCacheAccess: async (cacheContext) => {
    const serialized = readCache();
    if (serialized) cacheContext.tokenCache.deserialize(serialized);
  },
  afterCacheAccess: async (cacheContext) => {
    if (cacheContext.cacheHasChanged) {
      writeCache(cacheContext.tokenCache.serialize());
    }
  },
};

// ── MSAL client ────────────────────────────────────────────────────────────
let _pca = null;

function getPca() {
  if (_pca) return _pca;
  _pca = new PublicClientApplication({
    auth: {
      clientId: CLIENT_ID,
      authority: AUTHORITY,
    },
    cache: { cachePlugin },
    system: {
      loggerOptions: {
        logLevel: LogLevel.Warning,
        piiLoggingEnabled: false,
        loggerCallback: (level, message) => {
          if (level <= LogLevel.Warning) console.log('[msal]', message);
        },
      },
    },
  });
  return _pca;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatUser(account) {
  return {
    name:  account.name  || account.username,
    email: account.username,
    id:    account.localAccountId,
  };
}

function validateDomain(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

// ── Silent auth (on startup) ───────────────────────────────────────────────
async function getAuthStatus() {
  const pca = getPca();
  try {
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (!accounts || accounts.length === 0) return { loggedIn: false };

    // Force an interactive re-consent if we haven't acquired the Graph scopes yet.
    // This happens once after the scope list is expanded (e.g. adding Tasks.ReadWrite).
    // MSAL will detect the new scopes and prompt only if needed.

    // Try silent refresh for the first valid account
    const account = accounts[0];
    const result = await pca.acquireTokenSilent({
      scopes: SCOPES,
      account,
      forceRefresh: false,
    });

    if (!validateDomain(result.account.username)) {
      // Wrong org — clear and reject
      await logout();
      return { loggedIn: false, error: 'Not a @theexoticsnetwork.com account.' };
    }

    return { loggedIn: true, user: formatUser(result.account) };
  } catch (err) {
    // Token expired / no refresh token → user must log in again
    console.log('[auth] Silent acquire failed:', err.message);
    return { loggedIn: false };
  }
}

// ── Full interactive login (opens browser, waits for redirect) ─────────────
async function interactiveLogin(openExternal) {
  const port       = REDIRECT_PORT;
  const redirectUri = REDIRECT_URI;

  const serverPromise = new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname !== '/auth/callback') {
        res.writeHead(404); res.end(); return;
      }

      const { code, error, error_description } = parsed.query;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <head><title>TEN Document Studio</title></head>
          <body style="background:#070707;color:#c9a96e;font-family:'Helvetica Neue',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;flex-direction:column;gap:16px">
            <div style="font-size:52px;letter-spacing:.35em;font-weight:900">TEN</div>
            <div style="font-size:13px;letter-spacing:.12em;opacity:.65;text-transform:uppercase">
              ${error ? 'Sign-in failed — you may close this tab.' : 'Signed in — returning to TEN Document Studio…'}
            </div>
            <script>setTimeout(()=>window.close(),2500)</script>
          </body>
        </html>`);

      server.close();
      if (error) reject(new Error(error_description || error));
      else resolve(code);
    });

    server.on('error', (err) => {
      reject(new Error(`Could not start auth callback server: ${err.message}`));
    });

    // Bind to all interfaces so the redirect reaches us whether the OS
    // resolves 'localhost' to 127.0.0.1 (IPv4) or ::1 (IPv6).
    server.listen(port, async () => {
      try {
        const pca = getPca();
        const authUrl = await pca.getAuthCodeUrl({
          scopes: SCOPES,
          redirectUri,
          prompt: 'login',  // force fresh login every time (avoids stale SSO session issues)
        });
        await openExternal(authUrl);
      } catch (err) {
        server.close();
        reject(err);
      }
    });

    // 5-minute safety timeout
    setTimeout(() => {
      server.close();
      reject(new Error('Login timed out. Please try again.'));
    }, 5 * 60 * 1000);
  });

  const code = await serverPromise;
  const pca = getPca();

  const result = await pca.acquireTokenByCode({
    code,
    scopes: SCOPES,
    redirectUri,  // must match the URI used to generate the auth URL
  });

  if (!validateDomain(result.account.username)) {
    // Sign them out immediately
    const accounts = await pca.getTokenCache().getAllAccounts();
    for (const acct of accounts) {
      await pca.getTokenCache().removeAccount(acct);
    }
    clearCache();
    throw new Error(`Only @${ALLOWED_DOMAIN} accounts are permitted.`);
  }

  return { loggedIn: true, user: formatUser(result.account) };
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function logout() {
  const pca = getPca();
  try {
    const accounts = await pca.getTokenCache().getAllAccounts();
    for (const acct of accounts) {
      await pca.getTokenCache().removeAccount(acct);
    }
  } catch {}
  clearCache();
  _pca = null;  // Destroy the MSAL instance so the next login starts completely fresh
  return { loggedIn: false };
}

// ── Token acquisition for Graph API calls ─────────────────────────────────
/**
 * Acquire an access token silently for the cached account.
 * Returns the raw access token string, or throws if not signed in.
 */
async function getAccessToken() {
  const pca = getPca();
  const accounts = await pca.getTokenCache().getAllAccounts();
  if (!accounts || accounts.length === 0) throw new Error('Not authenticated');
  const result = await pca.acquireTokenSilent({
    scopes: SCOPES,
    account: accounts[0],
    forceRefresh: false,
  });
  return result.accessToken;
}

module.exports = { getAuthStatus, interactiveLogin, logout, getAccessToken };
