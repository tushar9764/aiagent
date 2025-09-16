// scripts/spawner.js
import "dotenv/config";
import { listDepartments, createTicket } from "../zoho/tickets.js";

const {
  ZOHO_ACCOUNTS_URL,
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_BASE_URL,
  ZOHO_ORG_ID,
  SPAWN_CONTACT_ID,
  SPAWN_EMAIL,
} = process.env;

const CONTACT_ID = SPAWN_CONTACT_ID || "216183000000321001";
const INTERVAL_MS = Number(process.env.SPAWN_INTERVAL_MS || 1500);

const SUBJECTS = [
  "Login not working",
  "Refund needed for last invoice",
  "Shipping delay on order",
  "Feature request: dark mode",
  "Error 500 on dashboard",
  "Password reset loop",
];

async function getToken() {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: ZOHO_CLIENT_ID,
    client_secret: ZOHO_CLIENT_SECRET,
    refresh_token: ZOHO_REFRESH_TOKEN,
  });

  const res = await fetch(ZOHO_ACCOUNTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`[token] ${JSON.stringify(data)}`);
  return data.access_token;
}

function buildTicketPayload({ subject, departmentId }) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return {
    subject,
    departmentId,
    description: `Auto-spawned test ticket at ${ts}\nSource: spawner.js`,
    status: "Open",
    priority: "High",
    ...(CONTACT_ID ? { contactId: CONTACT_ID } : {}),
    ...(SPAWN_EMAIL ? { email: SPAWN_EMAIL } : {}),
  };
}

async function main() {
  // quick env sanity (helps catch “it used to work” drift)
  ["ZOHO_ACCOUNTS_URL","ZOHO_CLIENT_ID","ZOHO_CLIENT_SECRET","ZOHO_REFRESH_TOKEN","ZOHO_BASE_URL","ZOHO_ORG_ID"]
    .forEach(k => { if (!process.env[k]) console.warn(`[warn] missing ${k}`); });

  const token = await getToken();

  const depts = await listDepartments({ baseUrl: ZOHO_BASE_URL, token, orgId: ZOHO_ORG_ID });
  if (!depts?.length) throw new Error("No departments found in Zoho Desk.");
  const departmentId = depts[0].id;

  console.log(`Spawner running… will create a ticket every ${INTERVAL_MS/1000}s in dept ${depts[0].name}`);

  setInterval(async () => {
    try {
      const subject = SUBJECTS[Math.floor(Math.random() * SUBJECTS.length)];
      const ticketPayload = buildTicketPayload({ subject, departmentId });
      await createTicket({ baseUrl: ZOHO_BASE_URL, token, orgId: ZOHO_ORG_ID, ticket: ticketPayload });
      console.log(`[SPAWNED] ${subject}`);
    } catch (e) {
      console.error("[SPAWNER ERR]", e?.response?.data || e?.message || e);
    }
  }, INTERVAL_MS);
}

main().catch(e => console.error("[FATAL SPAWNER]", e?.response?.data || e?.message || e));
