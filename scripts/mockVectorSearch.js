// scripts/mockVectorSearch.js
// ESM + Node 18+
// Usage: node scripts/mockVectorSearch.js <ticketId> --k=5 --candidates=100

import "dotenv/config.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { vectorSearch } from "./vectorSearchFunction.js";

// Adjust this import to match your actual model filename:
// If your file is models/Tickets.js, change to "../models/Tickets.js"
import Ticket from "../models/Tickets.js";

import { embed } from "../ai/embeddings.js";
import { normalizeText } from "../utils/text.js";

// -------------------- args --------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const [, , ticketIdArg, ...rest] = process.argv;
if (!ticketIdArg) {
  console.error(
    "Usage: node scripts/mockVectorSearch.js <ticketId> [--k=5] [--candidates=100]"
  );
  process.exit(1);
}
const args = Object.fromEntries(
  rest
    .filter((s) => s.startsWith("--"))
    .map((s) => {
      const [k, v] = s.replace(/^--/, "").split("=");
      return [k, v ?? "true"];
    })
);
const TOP_K = Number(args.k ?? 5);
const NUM_CANDIDATES = Number(args.candidates ?? 100);

// -------------------- db connect --------------------
mongoose.set("strictQuery", true); //avoid made up fields in document
mongoose.set("bufferCommands", false); // if true helps us query data before connecting to db, using queue

async function connectOnce() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI missing in environment.");
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  console.log(`[mongo] connected → ${mongoose.connection.name}`);
}

// -------------------- helpers --------------------
function cosine(a, b) {
  let dot = 0,
    na = 0,
    nb = 0;
  const L = Math.min(a?.length || 0, b?.length || 0);
  for (let i = 0; i < L; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

function pretty(row) {
  return {
    ticketId: row.ticketId,
    similarity: Number((row.similarity ?? row._sim ?? 0).toFixed(4)),
    subject: row.subject ?? "",
    category: row.category ?? "",
    site: row.site ?? "",
  };
}

// -------------------- main --------------------
(async () => {
  vectorSearch(ticketIdArg, TOP_K, NUM_CANDIDATES);
})().catch((err) => {
  console.error("[fatal]", err?.message || err);
  process.exit(1);
});
