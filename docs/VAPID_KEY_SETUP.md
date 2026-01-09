# VAPID Keys Setup Guide

## What is VAPID?

VAPID (Voluntary Application Server Identification) keys are required for Web Push Notifications. They identify your application server to the push service.

## Generating VAPID Keys

### Step 1: Install web-push globally (if not already installed)
```bash
npm install -g web-push
```

### Step 2: Generate new VAPID keys
```bash
npx web-push generate-vapid-keys
```

You'll see output like:
```
Public Key: BEnCVeBf...m_gkT8=
Private Key: eW5YZ2x...9K8DgXQ=
```

### Step 3: Add to environment variables

Create or update your `.env.local` file:
```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEnCVeBf...m_gkT8=
VAPID_PRIVATE_KEY=eW5YZ2x...9K8DgXQ=
```

**Important**: 
- Copy the **ENTIRE** key value, not a truncated version
- The public key should be approximately 88 characters (Base64URL encoded)
- When decoded, it should be exactly 65 bytes
- The private key should be approximately 44 characters

### Step 4: Restart your development server
```bash
npm run dev
```

## Troubleshooting

### Error: "Invalid public key length: 34 bytes"
This means your public key is truncated or incorrect. Follow these steps:
1. Generate new keys: \`npx web-push generate-vapid-keys\`
2. Copy the **full** Public Key value (not truncated)
3. Update NEXT_PUBLIC_VAPID_PUBLIC_KEY with the complete key
4. Restart your server

### Error: "VAPID keys not configured"
Make sure both environment variables are set:
- \`NEXT_PUBLIC_VAPID_PUBLIC_KEY\` (client-side, safe to expose)
- \`VAPID_PRIVATE_KEY\` (server-side, keep secret)

### Can I regenerate keys?
Yes! You can generate new keys at any time. Just update your environment variables and restart. Users who had old subscriptions may need to re-subscribe.

## Key Format Reference

A properly generated P-256 public key:
- Is Base64URL encoded
- Decodes to exactly 65 bytes
- Looks approximately like: \`BEnCVeBf9gZi3_NKGvD1Zm_gkT8=\` (varies each time)
- Is NOT a truncated or shortened version

## For Production Deployment

1. Generate new VAPID keys
2. Add \`NEXT_PUBLIC_VAPID_PUBLIC_KEY\` and \`VAPID_PRIVATE_KEY\` to your Vercel project settings (Vars section)
3. Redeploy your application
4. Existing subscriptions will need to re-subscribe to the push service with the new key
