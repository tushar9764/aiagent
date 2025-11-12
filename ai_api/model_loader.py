import spacy
from pathlib import Path

MODEL_PATH = Path(__file__).parent.parent / "scripts" / "output_model"
nlp = spacy.load(MODEL_PATH)

def extract_entities(text: str):
    doc = nlp(text)
    out = {}
    for ent in doc.ents:
        out.setdefault(ent.label_, []).append(ent.text)
    return out
