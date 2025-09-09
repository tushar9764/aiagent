// Node 18+, ESM ("type": "module"), npm i @xenova/transformers
import { pipeline } from "@xenova/transformers";

let embedder = null;

export async function getEmbedder() {
  if (!embedder) {
    console.log("Loading model… (first run will download it)");
    embedder = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    console.log("Model loaded.");
  }
  return embedder;
}

export async function embed(text) {
  if (!text || !text.trim()) return [];
  const model = await getEmbedder();
  const out = await model(text, { pooling: "mean", normalize: true });
  return Array.from(out.data); // 384-dim vector
}

// run directly: node ai/embeddings.js "your text"
import { fileURLToPath } from "url";
import path from "path";
const thisFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (thisFile === invokedFile) {
  (async () => {
    const msg = process.argv.slice(2).join(" ") || "pune internet down";
    const v = await embed(msg);
    console.log("Embedding length:", v.length);
    console.log("all", v);
  })();
}
