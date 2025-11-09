#!/usr/bin/env python3
# nerTrain.py — fine-tune an existing spaCy NER model using trainDataGen.txt

import spacy
import random
import ast
from pathlib import Path
from spacy.training.example import Example
from spacy.util import fix_random_seed

# ------------------------------------------------------------------
# CONFIG
# ------------------------------------------------------------------
BASE_MODEL = "en_core_web_sm"       # base model to fine-tune
OUTPUT_DIR = Path(__file__).parent / "output_model"
TRAIN_FILE = Path(__file__).parent / "trainDataGen.txt"
N_ITER = 30                         # number of epochs
SEED = 42

# ------------------------------------------------------------------
# SETUP
# ------------------------------------------------------------------
fix_random_seed(SEED)
random.seed(SEED)

# ------------------------------------------------------------------
# LOAD TRAINING DATA
# ------------------------------------------------------------------
print(f"📄 Loading training data from {TRAIN_FILE}")
try:
    with open(TRAIN_FILE, "r", encoding="utf-8") as f:
        data_text = f.read().strip()
    TRAIN_DATA = ast.literal_eval(data_text)
except Exception as e:
    raise ValueError(f"❌ Could not parse trainDataGen.txt: {e}")

print(f"✅ Loaded {len(TRAIN_DATA)} training examples")

# ------------------------------------------------------------------
# LOAD BASE MODEL SAFELY
# ------------------------------------------------------------------
try:
    nlp = spacy.load(BASE_MODEL)
    print(f"🧠 Loaded base model: {BASE_MODEL}")
except OSError:
    print(f"⚠️ Base model '{BASE_MODEL}' not found. Creating blank English model.")
    nlp = spacy.blank("en")

# Ensure 'ner' pipe exists
if "ner" not in nlp.pipe_names:
    ner = nlp.add_pipe("ner", last=True)
else:
    ner = nlp.get_pipe("ner")

# ------------------------------------------------------------------
# ADD LABELS DYNAMICALLY
# ------------------------------------------------------------------
for _, annotations in TRAIN_DATA:
    for start, end, label in annotations.get("entities"):
        ner.add_label(label)

# ------------------------------------------------------------------
# TRAINING LOOP
# ------------------------------------------------------------------
print("\n🚀 Starting NER fine-tuning...\n")
other_pipes = [p for p in nlp.pipe_names if p != "ner"]

# Use the correct optimizer initialization depending on spaCy version
if hasattr(nlp, "resume_training"):
    optimizer = nlp.resume_training()
else:
    optimizer = nlp.initialize()

with nlp.disable_pipes(*other_pipes):
    for epoch in range(N_ITER):
        random.shuffle(TRAIN_DATA)
        losses = {}
        batches = spacy.util.minibatch(TRAIN_DATA, size=8)
        for batch in batches:
            examples = [Example.from_dict(nlp.make_doc(text), annots) for text, annots in batch]
            nlp.update(examples, sgd=optimizer, drop=0.35, losses=losses)
        print(f"🌀 Iteration {epoch+1}/{N_ITER} - Loss: {losses}")

# ------------------------------------------------------------------
# SAVE TRAINED MODEL
# ------------------------------------------------------------------
OUTPUT_DIR.mkdir(exist_ok=True)
nlp.to_disk(OUTPUT_DIR)
print(f"\n💾 Model saved to: {OUTPUT_DIR.resolve()}")
print("✅ Fine-tuning complete! Compatible with spaCy", spacy.__version__)
