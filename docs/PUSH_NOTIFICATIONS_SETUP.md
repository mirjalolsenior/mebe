# Push Notifications Setup Guide - Android & iOS

## What Was Fixed

1. **Missing manifest.json** - Added proper PWA manifest with Android icon requirements
2. **Service Worker Registration** - Made registration more robust with explicit scope "/"
3. **Notification Permission Flow** - Removed auto-request on page load (critical for iOS)
4. **iOS Compatibility** - Removed unsupported notification features (badge, vibrate, multiple actions)
5. **Comprehensive Logging** - Added debug logs throughout for troubleshooting

## Android Setup

### Requirements
- HTTPS (required, development uses localhost)
- Valid manifest.json with icons
- Service Worker registered with scope "/"

### Icon Requirements
- **192x192px** PNG or JPEG in /public/icon-192.jpg
- **512x512px** PNG or JPEG in /public/icon-512.jpg
- Format: PNG or JPEG (NOT SVG)
- Display mode: "standalone"

### Testing on Android Chrome
1. Open DevTools: F12 or Cmd+Option+I
2. Go to **Application > Service Workers**
3. Verify service worker shows "activated and running"
4. Click notification settings button in app
5. Click "Enable Notifications"
6. Grant permission when prompted
7. Test with "Send Test Notification" button

### Troubleshooting Android
- **Service Worker won't register**: Check DevTools Application tab, look for errors
- **Push subscriptions fail**: Ensure HTTPS, check VAPID keys are valid
- **Notifications don't appear**: Verify Android notification settings, check app battery optimization

## iOS Setup

### Requirements
- iOS 16.4 or later (PWA support with notifications)
- App must be installed to home screen
- HTTPS required
- Safari or compatible browser

### Installation Steps
1. Open app in Safari on iPhone
2. Tap Share button (bottom of screen)
3. Scroll down, tap "Add to Home Screen"
4. Name the shortcut, tap Add
5. Open app from home screen
6. Wait for Service Worker to register (see console logs)
7. Click "Enable Notifications" button
8. When prompted, allow notifications in Settings > Notifications

### iOS Limitations
- Notifications only work in installed PWA mode (home screen shortcut)
- Web version: limitations on background notifications
- Reduced action buttons (max 1 vs Android's 2)
- No vibration support
- No badge support

### Testing on iOS Safari
1. Open app in Safari
2. Open Developer Console: Settings > Safari > Advanced > Web Inspector
3. Install to home screen and open from shortcut
4. Console logs appear in Safari's Web Inspector
5. Click "Enable Notifications"
6. Grant permission in Settings > Notifications > Sherdor Mebel
7. Close and re-open app from home screen
8. Test notifications

## Permission Flow Explained

### Why No Auto-Request?
- iOS explicitly requires user interaction for notification requests
- Auto-requesting violates Apple's PWA guidelines
- Users have better control with explicit button click

### Flow:
1. User clicks "Enable Notifications" button
2. Browser requests Notification permission
3. If granted:
   - Service Worker registers
   - Device subscribes to push notifications
   - Server stores subscription

## Console Logs for Debugging

All actions log to browser console:
- `[PWA]` - Client-side PWA initialization logs
- `[SW]` - Service Worker logs
- Filter by these tags in DevTools Console

Key logs to look for:
- "Service Worker registered successfully"
- "Push API support: true/false"
- "Detected iOS/Android platform"
- "Notification permission result: granted"
- "Active push subscription found"

## Testing Checklist

### Android
- [ ] Service Worker shows "activated and running" in DevTools
- [ ] App can be installed (Install prompt appears)
- [ ] Manifest.json loads (check Network tab)
- [ ] Notifications permission can be requested
- [ ] Test notification displays when app is open
- [ ] Test notification displays when app is closed
- [ ] Clicking notification opens correct URL

### iOS
- [ ] App installs to home screen
- [ ] Service Worker registers (check console)
- [ ] Notification permission can be requested
- [ ] Notifications work in installed PWA
- [ ] Clicking notification opens correct URL

## Advanced: Manual Testing with curl

To send test push notifications from server:

```bash
curl -X POST http://localhost:3000/api/send-push \\
  -H "Content-Type: application/json" \\
  -H "X-CRON-SECRET: your-secret" \\
  -d '{"title":"Test","body":"This is a test"}'
```

## Troubleshooting Summary

| Issue | Android | iOS |
|-------|---------|-----|
| Service Worker won't install | Check HTTPS, manifest.json | Check HTTPS, installed mode |
| Notifications don't show | Check browser notification settings | Check Settings > Notifications |
| Push not working | Check VAPID keys, service worker active | Must be in standalone mode |
| Permission denied | Check Settings > Apps > Notifications | Check Settings > Notifications |

## Next Steps

1. Ensure icons (192x192 and 512x512) are in /public/
2. Deploy to HTTPS (required for both platforms)
3. Test on real Android device with Chrome
4. Test on real iOS device with Safari (install to home screen)
5. Monitor console logs during testing
```
</markdown>
