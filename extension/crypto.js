// AES-GCM helper using WebCrypto. Passphrase is stretched via PBKDF2.
// The plaintext NEVER leaves the browser unencrypted — server stores ciphertext only.

const enc = new TextEncoder();
const dec = new TextDecoder();

async function deriveKey(passphrase, saltStr) {
  const salt = enc.encode(saltStr || "jobpilot-cookie-pipe-v1");
  const baseKey = await crypto.subtle.importKey(
    "raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 120_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

function b64(buf) {
  const arr = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < arr.length; i++) s += String.fromCharCode(arr[i]);
  return btoa(s);
}

self.jpEncrypt = async function encryptJson(obj, passphrase) {
  if (!passphrase || passphrase.length < 8) throw new Error("passphrase too short");
  const key = await deriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const pt = enc.encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pt);
  return { ciphertext: b64(ct), iv: b64(iv) };
};
