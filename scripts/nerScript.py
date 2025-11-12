# import spacy

# # Load the small English model
# nlp = spacy.load("en_core_web_sm")

# # Example text
# text = """Ticket: bgp flap noticed at the primary router of Apollo Hospital in Bengaluru"""

# # Process the text
# doc = nlp(text)

# # Print detected entities
# for ent in doc.ents:
#     print(ent.text, "→", ent.label_)


import spacy

# Load your fine-tuned model (path from nerTrain.py)
nlp = spacy.load("scripts/output_model")

# Example text
text = """Ticket: Users in the Bengaluru office are experiencing intermittent issues with DNS resolution. Queries to internal and external domains are timing out or returning incorrect IP addresses. Troubleshooting indicates a possible issue with the DNS servers or the network connectivity to them."""

# Process the text
doc = nlp(text)

# Print entities
for ent in doc.ents:
    print(ent.text, "→", ent.label_)
