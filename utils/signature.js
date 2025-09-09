// utils/signature.js
import crypto from "crypto";

export function signatureOf(normalizedText) {
  return crypto.createHash("sha256").update(normalizedText).digest("hex");
}


//console.log(signatureOf("boba teaaaa"));