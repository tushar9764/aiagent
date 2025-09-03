// models/Ticket.js
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const TicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true,
    unique: true,
  },
  site: {
    type: String,
  },
  isp: {
    type: String,
  },
  category: {
    type: String,
  },
  subject: {
    type: String,
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  signature: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// compound index for faster recurring detection
TicketSchema.index({ createdAt: 1, signature: 1 });

const Ticket = mongoose.model("Ticket", TicketSchema);

export default Ticket;
