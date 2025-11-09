#!/usr/bin/env python3
# generate_ner_data.py — auto-generate NER training data with correct offsets

import random
from pathlib import Path

# ---------------------------------------------------
# CONFIG — tweak these lists anytime
# ---------------------------------------------------
issues = ["bgp flap", "link down", "packet loss", "high latency", "network congestion"]
clients = ["Manipal Hospital", "Apollo Clinic", "Cloud9 Hospital", "Fortis Healthcare", "City Diagnostics"]
locations = ["Indiranagar, Bengaluru", "Koramangala, Bengaluru", "MG Road, Pune", "Whitefield, Bengaluru", "Kothrud, Pune"]

templates = [
    "{issue} noticed at {client} in {location}",
    "Alert: {client} facing {issue} near {location}",
    "{client} in {location} reported a {issue}",
    "Detected {issue} impacting {client} located at {location}",
    "Incident report — {issue} observed for {client} at {location}",
    "Technicians confirmed {issue} at {client}, {location}",
    "Monitoring systems flagged {issue} in {client} near {location}"
]

OUTPUT_FILE = Path(__file__).parent / "trainDataGen.txt"
NUM_SAMPLES = 300  # change if you want more or fewer samples

# ---------------------------------------------------
# GENERATE DATA
# ---------------------------------------------------
data = []
for _ in range(NUM_SAMPLES):
    issue = random.choice(issues)
    client = random.choice(clients)
    location = random.choice(locations)
    template = random.choice(templates)

    text = template.format(issue=issue, client=client, location=location)
    entities = []

    for value, label in [(issue, "issue"), (client, "client"), (location, "location")]:
        start = text.find(value)
        end = start + len(value)
        entities.append((start, end, label))

    data.append((text, {"entities": entities}))

# ---------------------------------------------------
# SAVE TO FILE
# ---------------------------------------------------
OUTPUT_FILE.write_text(str(data), encoding="utf-8")
print(f"✅ Generated {len(data)} training samples to {OUTPUT_FILE}")
