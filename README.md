# AiAgent

Zoho AI Ticket Agent

What it Does?

Cuts first-response time by auto-summarizing, classifying, and prioritizing new Zoho Desk tickets the moment they arrive — no manual prompts or UI clicks.

Features:

AI-generated ticket summaries (private notes)
Auto category + priority assignment
Runs continuously, polling Zoho Desk
Test ticket generator included

Quick Start:

Create .env:
ZOHO_CLIENT_ID=...
ZOHO_CLIENT_SECRET=...
ZOHO_REFRESH_TOKEN=...
ZOHO_ORG_ID=...
ZOHO_DEPT_ID=...
ANTHROPIC_API_KEY=...


Run the agent:
node index.js

Spawn test tickets:
node scripts/spawner.js

Future Additions:
Auto-assign to correct agent/department + notify by email
Auto-translate tickets to/from English
Weekly reports: tickets processed, time saved, category trends