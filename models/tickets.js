import mongoose from "mongoose";

const TicketSchema = new mongoose.Schema(
  {
    ticketId: { type: String, required: true, unique: true },

    // raw fields from source
    client: String,
    location:String,
    issue: String,
    isp: String,
    category: String,
    subject: String,
    description: String,   // ← add this if you have it
    status: String,        // e.g. "open", "closed"
    priority: String,      // e.g. "low", "high"

    // normalized text used for hashing & embedding (subject + description, cleaned)
    normalizedText: { type: String, index: false },

    // deterministic signature for quick exact-ish duplicates (e.g., SHA256 of normalizedText)
    signature: { type: String, required: true, index: true },

    // vector embedding (store as array of Numbers; prefer Float32 in app before save)
    embedding: { type: [Number], default: undefined },   // length ~384 or 768 depending on model
    embeddingModel: { type: String, default: "all-MiniLM-L6-v2" }, // or your chosen model
    embeddingDim: { type: Number, default: 384 },

    // recurring grouping
    groupId: { type: String, index: true },   // id of the recurring cluster
    similarityToGroup: { type: Number },      // best cosine similarity within the group
    recurrenceCount: { type: Number, default: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },

    createdAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

// helpful indexes
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ category: 1, createdAt: -1 });
TicketSchema.index({ signature: 1, createdAt: -1 });
TicketSchema.index({ groupId: 1, lastSeenAt: -1 });

// (Optional) text index to support keyword fallbacks
TicketSchema.index({ subject: "text", description: "text" });

const Ticket = mongoose.model("Ticket", TicketSchema);
export default Ticket;
