const Ticket = require("../models/tickets");

// Save or update a ticket
async function saveTicket(rawTicket) {
  try {
    // Build a signature if fields exist
    const signature = [rawTicket.site, rawTicket.isp, rawTicket.category]
      .filter(Boolean)
      .join("|");

    const ticketDoc = {
      ticketId: rawTicket.id,
      site: rawTicket.site,
      isp: rawTicket.isp,
      category: rawTicket.category,
      subject: rawTicket.subject,
      createdAt: rawTicket.createdAt || new Date(),
      signature
    };

    // Upsert: insert if not found, update if exists
    await Ticket.updateOne(
      { ticketId: rawTicket.id },
      { $set: ticketDoc },
      { upsert: true }
    );

    return { status: "ok" };
  } catch (err) {
    console.error("Error saving ticket:", err);
    return { status: "error", error: err };
  }
}

// (optional) Fetch tickets by signature + date range
async function getTicketsBySignature(signature, startDate, endDate) {
  return Ticket.find({
    signature,
    createdAt: { $gte: startDate, $lte: endDate }
  }).sort({ createdAt: 1 });
}

module.exports = {
  saveTicket,
  getTicketsBySignature
};
