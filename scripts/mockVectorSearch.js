// scripts/mockVectorSearch.js
// ESM + Node 18+
// Usage: node scripts/mockVectorSearch.js <ticketId> --k=5 --candidates=100

import "dotenv/config.js";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";

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
  await connectOnce();

  // 1) load the anchor ticket
  const anchor = await Ticket.findOne({ ticketId: String(ticketIdArg) }).lean();
  if (!anchor) {
    console.error(`[x] Ticket ${ticketIdArg} not found in DB.`);
    process.exit(2);
  }

  // 2) ensure we have a query vector
  let queryVector = anchor.embedding;
  if (!Array.isArray(queryVector) || !queryVector.length) {
    const text = normalizeText(anchor.subject || "", anchor.description || "");
    console.log(`[vec] embedding anchor on-the-fly (no embedding stored)`);
    queryVector = await embed(text);
  }

  // 3) try Atlas Vector Search first
  try {
    //console.log("anchor.site =", JSON.stringify(anchor.site));

    const days = 30; // change to 31 if you want a wider month window
    const ms = 24 * 60 * 60 * 1000;
    const windowStart = new Date(anchor.updatedAt.getTime() - days * ms);
    const windowEnd = new Date(anchor.updatedAt.getTime() + days * ms);

    const filter = {
      site: anchor.site,
      updatedAt: { $gte: windowStart, $lte: windowEnd },
    };
    const pipe = [
      {
        $vectorSearch: {
          index: "default",
          path: "embedding",
          queryVector,
          numCandidates: NUM_CANDIDATES,
          limit: TOP_K + 1, // +1 so we can drop the anchor itself
          filter,
        },
      },
      {
        $project: {
          ticketId: 1,
          subject: 1,
          category: 1,
          site: 1,
          similarity: { $meta: "vectorSearchScore" },
        },
      },
    ];

    let hits = await Ticket.aggregate(pipe);
    // remove the anchor ticket if it appears
    hits = hits
      .filter((h) => String(h.ticketId) !== String(anchor.ticketId))
      .slice(0, TOP_K);

    console.log("\n=== Vector Search (Atlas) ===");
    console.table(hits.map(pretty));
    process.exit(0);
  } catch (e) {
    // If vector search isn't enabled (free tier or index missing), we fall back.
    const msg = e?.message || String(e);
    console.warn(
      `[warn] $vectorSearch failed (${msg}). Falling back to local cosine…`
    );
  }

  // 4) fallback: local cosine over recent candidates
  const since = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000); // last 180 days
  const candidates = await Ticket.find({
    createdAt: { $gte: since },
    ticketId: { $ne: String(anchor.ticketId) },
    embedding: { $exists: true, $type: "array", $ne: [] },
  })
    .select({ ticketId: 1, subject: 1, category: 1, site: 1, embedding: 1 })
    .lean();

  const scored = [];
  for (const c of candidates) {
    const s = cosine(queryVector, c.embedding);
    scored.push({ ...c, _sim: s });
  }
  scored.sort((a, b) => b._sim - a._sim);
  const top = scored.slice(0, TOP_K);

  console.log("\n=== Local Cosine (fallback) ===");
  console.table(top.map(pretty));
  process.exit(0);
})().catch((err) => {
  console.error("[fatal]", err?.message || err);
  process.exit(1);
});
