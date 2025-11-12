from fastapi import FastAPI, Request
from model_loader import extract_entities

app = FastAPI()

@app.post("/extract")
async def extract(request: Request):
    data = await request.json()
    text = data.get("description", "")
    entities = extract_entities(text)
    return {"entities": entities}
