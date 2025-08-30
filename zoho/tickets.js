// zoho/tickets.js
import axios from "axios";
import nodemailer  from "nodemailer";

export function zohoHeaders(token, orgId) {
  return { Authorization: `Zoho-oauthtoken ${token}`, orgId };
}

// Get tickets (optionally filter by status)
export async function listTickets({ baseUrl, token, orgId, limit = 10, status }) {
  const res = await axios.get(`${baseUrl}/tickets`, {
    headers: zohoHeaders(token, orgId),
    params: { limit, ...(status ? { status } : {}) }
  });
  return res.data?.data || res.data || [];
}

// Add a PRIVATE note
export async function addPrivateNote({ baseUrl, token, orgId, ticketId, text }) {
  await axios.post(
    `${baseUrl}/tickets/${ticketId}/comments`,
    { isPublic: false, content: text },
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

// ✅ Update priority (Zoho expects PUT on /tickets/{id})
export async function updatePriority({ baseUrl, token, orgId, ticketId, priority }) {
  await axios.put(
    `${baseUrl}/tickets/${ticketId}`,
    { priority },
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

// zoho/tickets.js (add these at the bottom)
export async function listDepartments({ baseUrl, token, orgId }) {
  const res = await axios.get(`${baseUrl}/departments`, {
    headers: zohoHeaders(token, orgId)
  });
  return res.data?.data || res.data || [];
}

export async function createTicket({ baseUrl, token, orgId, ticket }) {
  await axios.post(
    `${baseUrl}/tickets`,
    ticket,
    { headers: { ...zohoHeaders(token, orgId), "Content-Type": "application/json" } }
  );
}

export async function sendEmail({receiverEmail, ai}){
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp.office365.com",
      port: 587,  //SMTP 
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
      tls: {
        rejectUnauthorized: false, // <- sometimes needed for corporate Outlook
      },
    });

    const mailOptions = {
      from: `"ZOHO Agent" <${process.env.EMAIL}>`,
      to: receiverEmail,
      subject: "Ticket Updated On Behalf Of You",
      html: `
        <p>Dear Customer,</p>

<p>This is to inform you that your open ticket has been updated on your behalf by our Zoho AI Agent.</p>

<p>Details of the update:</p>
<ul>
  <li><strong>Summary:</strong> ${ai.summary}</li>
  <li><strong>Category:</strong> ${ai.category}</li>
  <li><strong>Priority:</strong> ${ai.priority} (${ai.priority_reason ?? "n/a"})</li>
  <li><strong>Tags:</strong> ${ai.tags?.join(", ") ?? "none"}</li>
</ul>

<p>If you have any questions or need further assistance, please feel free to reach out.</p>

<p>Best regards,<br>
The Support Team (Zoho AI Agent)</p>

      `,
    };

    const info = await transporter.sendMail(mailOptions);
  } catch (err) {
    console.error("Error sending email:", err);
    throw err;
  }
}