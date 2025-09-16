// dbOperations/ticketVectors.js
import Ticket from "../models/Tickets.js";
import { normalizeText } from "../utils/text.js";
import { signatureOf } from "../utils/signature.js";
import { embed } from "../ai/embeddings.js";

export async function upsertTicketWithVectors({
  ticketId, subject = "", description = "", site = "", isp = "",
  category = "", status = "Open", priority = ""
}) {

  console.log("ticket upload to db function summoned");
  const normalizedText = normalizeText(subject, description);
  const signature = signatureOf(normalizedText);
  const embedding = await embed(normalizedText);

  return Ticket.findOneAndUpdate(
    { ticketId: String(ticketId) },
    {
      $set: {
        ticketId: String(ticketId),
        site, isp, category, subject, description, status, priority,
        normalizedText, signature, embedding,
        embeddingModel: "all-MiniLM-L6-v2",
        embeddingDim: embedding.length,
        lastSeenAt: new Date(),
      },
      $setOnInsert: { firstSeenAt: new Date() },
    },
    { upsert: true, new: true }
  );
}
