// index.js
import "dotenv/config";
import { startWorker } from "./worker/poller.js";

const required = [
  "ZOHO_CLIENT_ID","ZOHO_CLIENT_SECRET","ZOHO_REFRESH_TOKEN",
  "ZOHO_ORG_ID","ZOHO_BASE_URL","ZOHO_ACCOUNTS_URL"
];
const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.error("Missing env:", missing.join(", "));
  process.exit(1);
}

console.log("Zoho AI Agent starting (local)…");
startWorker(process.env);
