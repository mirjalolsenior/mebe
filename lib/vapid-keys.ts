// Generate VAPID keys for Web Push API
// In production, store these in environment variables

// IMPORTANT: Keep these separate:
// - NEXT_PUBLIC_VAPID_PUBLIC_KEY: Used on client-side only for PushManager.subscribe()
// - VAPID_PRIVATE_KEY: Used on server-side only for web-push library
// NEVER mix or expose the private key to the client

export const VAPID_KEYS = {
  publicKey:
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    "BDTvkEJJfVpJ4g3-QnN5dN6w1e4d5eH4d5eH4d5eH4d5eH4d5eH4d5eH4d5eH4d5eH4d5eH4",
  privateKey: process.env.VAPID_PRIVATE_KEY || "your-vapid-private-key-here",
}

// Note: Generate your own VAPID keys using:
// npx web-push generate-vapid-keys
export function getPublicVAPIDKey() {
  return VAPID_KEYS.publicKey
}

export function getPrivateVAPIDKey() {
  return VAPID_KEYS.privateKey
}
