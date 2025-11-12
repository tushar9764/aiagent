import axios from "axios";

const NER_API_URL = process.env.NER_API_URL;

export async function getEntities(description) {
  try {
    const res = await axios.post(NER_API_URL, {
      description,
    });

    const entities = res.data.entities;
    return {
      issue: entities.issue?.[0] || "",
      client: entities.client?.[0] || "",
      location: entities.location?.[0] || "",
    };
  } catch (err) {
    console.error("NER API error:", err.message);
    return { issue: "", client: "", location: "" };
  }
}
