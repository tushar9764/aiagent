// ai/triage.js
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORIES } from "../config/settings.js";

// Simple fallback if we don't/can't call an LLM
function heuristic(subject = "") {
  const s = subject.toLowerCase();
  if (s.includes("login") || s.includes("password")) return "Account";
  if (s.includes("refund") || s.includes("invoice") || s.includes("payment")) return "Billing";
  if (s.includes("ship") || s.includes("delivery") || s.includes("order")) return "Shipping";
  if (s.includes("error") || s.includes("bug") || s.includes("issue") || s.includes("not working")) return "Technical";
  if (s.includes("price") || s.includes("quote") || s.includes("buy")) return "Sales";
  return "Other";
}

export async function triage({ subject, description, customer_name, openaiKey }) {
  // We ignore openaiKey now; use Anthropic instead.
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    const cat = heuristic(subject);
    const prio = cat === "Billing" ? "Medium" : cat === "Technical" ? "High" : "Low";
    return {
      summary: `${customer_name || "Customer"}: ${subject}`.slice(0, 200),
      category: cat,
      priority: prio,
      priority_reason: "Heuristic v1",
      draft_reply:
        `Hi ${customer_name || "there"},\n\nThanks for reaching out about "${subject || "your issue"}". ` +
        `Please share any error messages, steps tried, and a screenshot if possible. We’re on it.\n\nBest,\nSupport`,
      confidence: null,
      tags: ["agent-triaged", `category-${cat.toLowerCase()}`],
    };
  }

  const prompt = `
Return strict JSON only with keys:
summary, category(one of ${CATEGORIES.join("|")}), priority(Low|Medium|High), priority_reason,
draft_reply, confidence(0..1 or null), tags(array like ["agent-triaged","category-<lowercase>"]).
Ticket:
Subject: ${subject}
Description: ${description}
Customer: ${customer_name || "Customer"}
`;

  const anthropic = new Anthropic({ apiKey: anthropicKey });

  try {
    const resp = await anthropic.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-3-5-haiku-latest",
      max_tokens: 600,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const text = (resp?.content?.[0]?.text || "").trim();
    let out;
    try {
      out = JSON.parse(text);
    } catch {
      // If Claude returns non‑JSON, fall back to heuristic
      const cat = heuristic(subject);
      out = {
        summary: subject || "Ticket",
        category: cat,
        priority: "Low",
        priority_reason: "Fallback",
        draft_reply: `Hi ${customer_name || "there"}, thanks for the details. We're investigating and will update you shortly.`,
        confidence: null,
        tags: ["agent-triaged", `category-${cat.toLowerCase()}`],
      };
    }
    // Ensure required fields exist
    out.confidence ??= null;
    if (!out.tags) out.tags = ["agent-triaged", `category-${(out.category || "other").toLowerCase()}`];
    return out;

  } catch (err) {
    // Network/quota/error → heuristic fallback
    const cat = heuristic(subject);
    return {
      summary: subject || "Ticket",
      category: cat,
      priority: "Low",
      priority_reason: "Fallback error",
      draft_reply: `Hi ${customer_name || "there"}, thanks for the details. We're investigating and will update you shortly.`,
      confidence: null,
      tags: ["agent-triaged", `category-${cat.toLowerCase()}`],
    };
  }
}
