import dotenv from "dotenv";
import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import Ticket from "../models/Tickets.js"; // adjust path if needed

dotenv.config(); // load .env   //run the file from directory where the .env is present

// MongoDB connection
async function connectDB() {
  try {
    const uri = process.env.MONGODB_URI;
    await mongoose.connect(uri, {
      dbName: "agent_data",
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ DB connection failed:", err);
    process.exit(1);
  }
}

// Mock ticket generator
async function createFakeTicket() {
  const fakeTicket = new Ticket({
    ticketId: uuidv4(),
    site: "Bangalore DC",
    isp: "JioFiber",
    category: "Network Issue",
    subject: "Packet loss detected",
    signature: "site-bangalore-jio-network-123",
  });

  try {
    const saved = await fakeTicket.save();
    console.log("🎉 Fake ticket created:", saved);
  } catch (err) {
    console.error("❌ Error creating ticket:", err.message);
  } finally {
    mongoose.connection.close();
  }
}

(async () => {
  await connectDB();
  await createFakeTicket();
})();
