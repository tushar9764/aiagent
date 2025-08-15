//Token Manager
// If no token or <5–10 min left → refresh using refresh_token.
// Provide accessToken
// zoho/auth.js

//basically generats a zoho access token cause it expires in 1hr

import axios from "axios";

export async function getAccessToken({
  accountsUrl,
  clientId,
  clientSecret,
  refreshToken
}) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });
  const res = await axios.post(accountsUrl, body.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  return { token: res.data.access_token, expiresIn: res.data.expires_in || 3600 };
}
