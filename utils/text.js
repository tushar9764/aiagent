// utils/text.js
export function normalizeText(subject = "", description = "") {
  const raw = `${subject} ${description}`.toLowerCase();
  return raw
    .replace(/[^\w\s]/g, " ")    // remove punctuation
    .replace(/\s+/g, " ")        // collapse spaces
    .trim();
}

//console.log(normalizeText("YOo,,,,OoOo","dUDDeeEe"));