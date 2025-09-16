// worker/poller.js
import { getAccessToken } from "../zoho/auth.js";
import {
  listTickets,
  addPrivateNote,
  updatePriority,
  sendEmail,
} from "../zoho/tickets.js";
import { triage } from "../ai/triage.js";
import { POLL_INTERVAL_MS } from "../config/settings.js";
import { upsertTicketWithVectors } from "../dbOperations/ticketVectors.js";
import mongoose from "mongoose";

mongoose.set("strictQuery", true);
mongoose.set("bufferCommands", false);

let mongoReady = false;
async function ensureMongo(uri) {
  if (mongoReady) return;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  mongoReady = true;
  console.log("[mongo] connected:", mongoose.connection.name);
}

const ACTIVE_STATUSES = "Open,On Hold,In Progress,Escalated";

// in‑memory cursors so we don’t spam the same tickets every cycle
let lastSeen = 0; // timestamp (ms)
const processedThisRun = new Set(); // ticket ids handled within a single cycle causes repeation

export function startWorker(env) {
  async function runOnce() {
    console.log("making mongodb connection");
    await ensureMongo(env.MONGODB_URI);

    processedThisRun.clear();
    try {
      // 1) always refresh access token (handles the 1‑hour expiry)
      const { token, expiresIn } = await getAccessToken({
        accountsUrl: env.ZOHO_ACCOUNTS_URL,
        clientId: env.ZOHO_CLIENT_ID,
        clientSecret: env.ZOHO_CLIENT_SECRET,
        refreshToken: env.ZOHO_REFRESH_TOKEN,
      });

      // 2) fetch a small batch of active tickets
      const tickets = await listTickets({
        //listTickets
        baseUrl: env.ZOHO_BASE_URL,
        token,
        orgId: env.ZOHO_ORG_ID,
        limit: 10,
        status: ACTIVE_STATUSES,
      });

      console.log(`Found ${tickets.length} active tickets.`);

      // 3) triage + update each ticket (skip old ones if we’ve run before)
      const now = Date.now();
      for (const t of tickets) {
        const ticketId = t.id;
        if (!ticketId || processedThisRun.has(ticketId)) continue;

        const createdMs = new Date(
          t.createdTime || t.modifiedTime || 0
        ).getTime();
        if (lastSeen && createdMs && createdMs < lastSeen) continue; // skip clearly old ones

        try {
          // 3a) AI triage (Claude or heuristic)
          const ai = await triage({
            subject: t.subject || "",
            description: t.description || "",
            customer_name: t?.contact?.firstName || t?.email || "Customer",
            openaiKey: env.OPENAI_API_KEY, // ignored if using Claude; triage handles fallback
          });

          console.log(`[db] upserting ${ticketId}…`);
          const ticketSaved= await upsertTicketWithVectors({
            //add this here so that even if the external side-effects (like email) fail the ticket is saved in db.
            ticketId: t.id,
            subject: t.subject || "",
            description: t.description || "",
            site: t.accountName || t?.contact?.accountName || "",
            isp: t?.cf_isp || "",
            category: ai.category,
            status: t.status || "Open",
            priority: ai.priority,
          });
          console.log(`[db] saved ${ticketId}`, ticketSaved);

          // 3b) build private note
          const note = `Summary: ${ai.summary}
           Category: ${ai.category}
           Priority: ${ai.priority} (${ai.priority_reason ?? "n/a"})
          `;

          // 3c) push updates to Zoho (note → priority)
          console.log(`→ addPrivateNote ${ticketId}`);
          console.log("ai:", ai);
          await addPrivateNote({
            //addPrivateNote
            baseUrl: env.ZOHO_BASE_URL,
            token,
            orgId: env.ZOHO_ORG_ID,
            ticketId,
            text: note,
          });

          console.log(`→ updatePriority ${ticketId}`);
          await updatePriority({
            //updatePriority
            baseUrl: env.ZOHO_BASE_URL,
            token,
            orgId: env.ZOHO_ORG_ID,
            ticketId,
            priority: ai.priority,
          });

          processedThisRun.add(ticketId);
          await sendEmail({ receiverEmail: "tushar.pd@aquaairx.com", ai: ai });
          console.log(`[OK] ${ticketId} → ${ai.category}/${ai.priority}`);
        } catch (innerErr) {
          const msg = innerErr?.response?.data || innerErr?.message || innerErr;
          console.error(`[ERR] ticket ${ticketId}:`, msg);
        }
      }

      lastSeen = now;
      console.log(`Refreshed token (exp ${expiresIn}s). Cycle done.`);
    } catch (err) {
      const msg = err?.response?.data || err?.message || err;
      console.error("[FATAL] cycle error:", msg);
    }
  }

  // run immediately, then on an interval
  runOnce();
  setInterval(runOnce, Number(POLL_INTERVAL_MS) || 120000);
}
