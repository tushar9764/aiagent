// zoho/tickets.js
import axios from "axios";

export function zohoHeaders(token, orgId) {
  return { Authorization: `Zoho-oauthtoken ${token}`, orgId };
}

// Get tickets (optionally filter by status)
export async function listTickets({ baseUrl, token, orgId, limit = 10, status }) {
  const res = await axios.get(`${baseUrl}/tickets`, {
    headers: zohoHeaders(token, orgId),
    params: { limit, ...(status ? { status } : {}) }
  });
  return res.data?.data || res.data || [];
}

// Add a PRIVATE note
export async function addPrivateNote({ baseUrl, token, orgId, ticketId, text }) {
  await axios.post(
    `${baseUrl}/tickets/${ticketId}/comments`,
    { isPublic: false, content: text },
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

// ✅ Update priority (Zoho expects PUT on /tickets/{id})
export async function updatePriority({ baseUrl, token, orgId, ticketId, priority }) {
  await axios.put(
    `${baseUrl}/tickets/${ticketId}`,
    { priority },
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

// zoho/tickets.js (add these at the bottom)
export async function listDepartments({ baseUrl, token, orgId }) {
  const res = await axios.get(`${baseUrl}/departments`, {
    headers: zohoHeaders(token, orgId)
  });
  return res.data?.data || res.data || [];
}

export async function createTicket({ baseUrl, token, orgId, ticket }) {
  await axios.post(
    `${baseUrl}/tickets`,
    ticket,
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

