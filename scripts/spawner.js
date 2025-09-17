// scripts/spawner_claude.js
import "dotenv/config";
import { listDepartments, createTicket } from "../zoho/tickets.js";

// =============== ENV / CONFIG ===============
const {
  ZOHO_ACCOUNTS_URL,
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_BASE_URL,
  ZOHO_ORG_ID,
  SPAWN_CONTACT_ID,
  SPAWN_EMAIL,
  // Claude / Anthropic
  ANTHROPIC_API_KEY,
  CLAUDE_MODEL = "claude-3-5-sonnet-latest",
  // Spawner cadence
  SPAWN_INTERVAL_MS = "3000",
  // Optional: bias the generator
  SPAWN_SITES, // e.g., "Pune,Chennai,Bengaluru,Hyderabad,Mumbai"
  SPAWN_ISPS, // e.g., "Airtel,BSNL,Jio,Tata,ACT"
} = process.env;

const CONTACT_ID = SPAWN_CONTACT_ID || "216183000000321001";
const INTERVAL_MS = Number(SPAWN_INTERVAL_MS) || 3000;

if (!ANTHROPIC_API_KEY) {
  console.warn(
    "[warn] ANTHROPIC_API_KEY not set — generator will fall back to static subjects when Claude is unavailable."
  );
}

// =============== HELPERS ===============
async function getZohoToken() {
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

const STATIC_SUBJECTS = [
  "BGP flap observed on edge router",
  "Packet loss on MPLS link to DC",
  "High latency to CDN PoP",
  "DHCP scope exhaustion at branch",
  "Frequent PPPoE disconnects on last mile",
  "Link down: core switch uplink gi1/0/24",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function clampPriority(severity) {
  // map L/M/H/Critical to Zoho priorities (tune if you have custom)
  const map = {
    Low: "Low",
    Medium: "Medium",
    High: "High",
    Critical: "High", // or "Urgent" if your desk supports it
  };
  return map[severity] || "High";
}

// =============== CLAUDE PROMPT ===============
function buildClaudeUserPrompt() {
  const sitePool = SPAWN_SITES?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) || [
    "Pune",
    "Chennai",
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "Delhi NCR",
    "Kolkata",
  ];
  const ispPool = SPAWN_ISPS?.split(",")
    .map((s) => s.trim())
    .filter(Boolean) || [
    "Airtel",
    "Jio",
    "BSNL",
    "Tata",
    "ACT",
    "Reliance",
    "Hathway",
  ];

  // We give Claude constraints + examples and ask for strict JSON.
  return `
You are generating realistic NOC incident tickets for a helpdesk (Zoho-like).

Return STRICT JSON ONLY (no prose). Fields:
{
  "subject": string,                     // short, ops-grade subject
  "description": string,                 // 2–5 sentences, with actionable details
  "category": string,                    // e.g., "Network", "ISP", "Hardware", "DNS", "BGP", "Wi-Fi"
  "site": string,                        // choose from: ${sitePool.join(", ")}
  "isp": string,                         // choose from: ${ispPool.join(", ")}
  "severity": "Low" | "Medium" | "High" | "Critical",
  "metadata": {
    "device": string,                    // e.g., "Edge-RTR-02" or "SW-Core-01"
    "interface": string,                 // e.g., "gi1/0/24" or "xe-0/0/1"
    "srcIP": string,                     // plausible IPv4
    "dstIP": string,                     // plausible IPv4
    "circuitId": string,                 // plausible looking ID or "-"
    "observedAt": string                 // ISO 8601 timestamp
  }
}

Be concrete and realistic (BGP flaps, packet loss %, latency ms, jitter ms, error counters, DHCP scope usage, PPPoE session churn, Wi-Fi channel interference, DNS timeout rates, etc.).
Avoid customer PII.

Examples (illustrative only, do not repeat):
{
  "subject": "Intermittent packet loss on MPLS Pune-DC (Airtel)",
  "description": "Alerts show 20–35% packet loss towards 10.14.32.0/20 via MPLS. Latency spikes from 12 ms to 180 ms since 10:12 IST. Errors increment on gi1/0/24. Suspect upstream provider issue or fiber degradation. Monitoring jitter and rerouting via backup if loss persists.",
  "category": "Network",
  "site": "Pune",
  "isp": "Airtel",
  "severity": "High",
  "metadata": {
    "device": "Edge-RTR-02",
    "interface": "gi1/0/24",
    "srcIP": "10.14.32.12",
    "dstIP": "172.16.200.10",
    "circuitId": "AIR-PLS-88421",
    "observedAt": "2025-09-17T16:05:42+05:30"
  }
}

Now generate ONE fresh incident as strict JSON.
`;
}

// =============== CLAUDE CALL ===============
async function generateIncidentWithClaude({ maxRetries = 2 } = {}) {
  const url = "https://api.anthropic.com/v1/messages";
  const headers = {
    "content-type": "application/json",
    "x-api-key": ANTHROPIC_API_KEY,
    "anthropic-version": "2023-06-01",
  };

  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 400,
    temperature: 0.7,
    system:
      "You are a senior NOC engineer generating realistic incident tickets for internal testing.",
    messages: [{ role: "user", content: buildClaudeUserPrompt() }],
  };

  let lastErr;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`[claude ${res.status}] ${txt}`);
      }
      const data = await res.json();
      // Anthropic returns content array with { type: "text", text: "..." }
      const text = data?.content?.[0]?.text?.trim();
      if (!text) throw new Error("Claude returned no text content");

      // Must be strict JSON
      const parsed = JSON.parse(text);
      return parsed;
    } catch (e) {
      lastErr = e;
      // small backoff
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// =============== SPAWNER CORE ===============
function buildTicketPayloadFromIncident(inc, departmentId) {
  const p = clampPriority(inc.severity);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  const descLines = [
    inc.description?.trim() || "",
    "",
    "—",
    `Category: ${inc.category || "-"}`,
    `Site: ${inc.site || "-"}`,
    `ISP: ${inc.isp || "-"}`,
    `Severity: ${inc.severity || "-"}`,
    inc.metadata
      ? `Device: ${inc.metadata.device || "-"}, Interface: ${
          inc.metadata.interface || "-"
        }`
      : "",
    inc.metadata
      ? `SrcIP: ${inc.metadata.srcIP || "-"}, DstIP: ${
          inc.metadata.dstIP || "-"
        }`
      : "",
    inc.metadata
      ? `Circuit: ${inc.metadata.circuitId || "-"}, ObservedAt: ${
          inc.metadata.observedAt || "-"
        }`
      : "",
    "",
    `Auto-spawned at ${ts} by spawner_claude.js`,
  ]
    .filter(Boolean)
    .join("\n");

  return {
    subject: inc.subject || pick(STATIC_SUBJECTS),
    departmentId,
    description: descLines,
    status: "Open",
    priority: p,
    ...(CONTACT_ID ? { contactId: CONTACT_ID } : {}),
    ...(SPAWN_EMAIL ? { email: SPAWN_EMAIL } : {}),
  };
}

async function main() {
  // quick env sanity
  [
    "ZOHO_ACCOUNTS_URL",
    "ZOHO_CLIENT_ID",
    "ZOHO_CLIENT_SECRET",
    "ZOHO_REFRESH_TOKEN",
    "ZOHO_BASE_URL",
    "ZOHO_ORG_ID",
  ].forEach((k) => {
    if (!process.env[k]) console.warn(`[warn] missing ${k}`);
  });

  const token = await getZohoToken();
  const depts = await listDepartments({
    baseUrl: ZOHO_BASE_URL,
    token,
    orgId: ZOHO_ORG_ID,
  });
  if (!depts?.length) throw new Error("No departments found in Zoho Desk.");
  const departmentId = depts[0].id;

  console.log(
    `Claude spawner running… every ${(INTERVAL_MS / 1000).toFixed(
      1
    )} s → dept ${depts[0].name}`
  );

  setInterval(async () => {
    try {
      let incident;
      if (ANTHROPIC_API_KEY) {
        try {
          incident = await generateIncidentWithClaude();
        } catch (e) {
          console.warn(
            "[claude] generation failed, falling back to static:",
            e.message
          );
        }
      }
      if (!incident) {
        // Static fallback if Claude fails or no API key
        incident = {
          subject: pick(STATIC_SUBJECTS),
          description:
            "Auto-generated fallback ticket. Replace with Claude once ANTHROPIC_API_KEY is configured.",
          category: "Network",
          site: "Pune",
          isp: "Airtel",
          severity: "High",
          metadata: {
            device: "-",
            interface: "-",
            srcIP: "-",
            dstIP: "-",
            circuitId: "-",
            observedAt: new Date().toISOString(),
          },
        };
      }

      const ticketPayload = buildTicketPayloadFromIncident(
        incident,
        departmentId
      );
      await createTicket({
        baseUrl: ZOHO_BASE_URL,
        token,
        orgId: ZOHO_ORG_ID,
        ticket: ticketPayload,
      });
      console.log(
        `[SPAWNED] ${ticketPayload.subject}  | site=${incident.site} isp=${incident.isp} sev=${incident.severity}`
      );
    } catch (e) {
      console.error("[SPAWNER ERR]", e?.response?.data || e?.message || e);
    }
  }, INTERVAL_MS);
}

main().catch((e) =>
  console.error("[FATAL SPAWNER]", e?.response?.data || e?.message || e)
);
