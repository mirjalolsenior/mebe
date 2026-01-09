// Clean, simple VAPID Base64URL to Uint8Array conversion
// P-256 public keys must be exactly 65 bytes

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  if (!base64String) {
    throw new Error(
      `[VAPID] Missing public key. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY in your environment variables.\n` +
        `Generate new keys with: npx web-push generate-vapid-keys`,
    )
  }

  // Convert Base64URL to Base64
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/")

  // Decode Base64 to binary string
  const rawData = atob(base64)

  // Convert binary string to Uint8Array
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  // Validate P-256 key length (must be 65 bytes)
  if (outputArray.length !== 65) {
    throw new Error(
      `[VAPID] Invalid public key length: ${outputArray.length} bytes. P-256 public keys must be exactly 65 bytes.\n\n` +
        `How to fix:\n` +
        `1. Run: npx web-push generate-vapid-keys\n` +
        `2. Copy the Public Key value\n` +
        `3. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the full public key> in your .env.local file\n` +
        `4. Set VAPID_PRIVATE_KEY=<the full private key> in your .env.local file\n\n` +
        `Note: Make sure you're copying the ENTIRE key, not a truncated version.`,
    )
  }

  return outputArray
}
