// scripts/mockVectorSearch.js
import "../pooler.js"; // ensures Mongo connection is open
import Ticket from "../models/Ticket.js";
import { normalizeText } from "../utils/text.js";
import { embed } from "../ai/embeddings.js";

/** cosine similarity helper */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;    
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

async function mockSearch(ticketId, { limit = 5, sampleSize = 200 } = {}) {
  const ticket = await Ticket.findOne({ ticketId: String(ticketId) }).lean();
  if (!ticket) throw new Error(`Ticket ${ticketId} not found`);

  let normalized = ticket.normalizedText;
  if (!normalized) {
    normalized = normalizeText(ticket.subject || "", ticket.description || "");
  }
  const qvec = ticket.embedding && ticket.embedding.length
    ? ticket.embedding
    : await embed(normalized);

  const pool = await Ticket.find({}, {
    _id: 0, ticketId: 1, subject: 1, embedding: 1
  }).limit(sampleSize).lean();

  const scored = pool
    .filter(t => t.ticketId !== String(ticketId) && Array.isArray(t.embedding))
    .map(t => ({
      ticketId: t.ticketId,
      subject: t.subject,
      similarity: cosine(qvec, t.embedding)
    }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return { query: { ticketId, subject: ticket.subject }, results: scored };
}

// CLI
const [, , ticketId] = process.argv;
if (!ticketId) {
  console.error("Usage: node scripts/mockVectorSearch.js <ticketId>");
  process.exit(1);
}

mockSearch(ticketId)
  .then(res => {
    console.log(JSON.stringify(res, null, 2));
    process.exit(0);
  })
  .catch(err => {
    console.error(err);
    process.exit(2);
  });
