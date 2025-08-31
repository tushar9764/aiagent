const mongoose = require("mongoose");

const TicketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    required: true, // Zoho ticket id
    unique: true
  },
  site: {
    type: String
  },
  isp: {
    type: String

  },
  category: {
    type: String
  },
  subject: {
    type: String
  },
  createdAt: {
    type: Date,
    required: true,
    default: Date.now
  },
  signature: {
    type: String,
    required: true 
  }
}, {
  timestamps: true // adds createdAt + updatedAt automatically
});

// compound index for faster recurring detection
TicketSchema.index({ signature: 1, createdAt: 1 });

module.exports = mongoose.model("Ticket", TicketSchema);
