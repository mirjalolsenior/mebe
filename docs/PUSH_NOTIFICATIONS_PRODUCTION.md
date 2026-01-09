# Production Push Notification System for Sherdor Mebel

This document describes the complete, production-ready push notification system for the Sherdor Mebel PWA business application.

## System Architecture

### Overview
- **Server-side scheduler**: Runs every 5 minutes via cron job
- **Database-driven state tracking**: Prevents duplicate notifications
- **Platform-aware delivery**: iOS, Android, and Web support
- **Error handling and recovery**: Automatic subscription cleanup

### Flow
1. Cron job triggers `/api/push-cron` every 5 minutes
2. Server queries orders and inventory in the database
3. For each notification event, checks if already notified
4. Sends push notification to all active subscriptions
5. Logs results in database for debugging and monitoring

## Core Business Rules

### 1. Order Deadline Notifications
- **Today's Orders**: Notifies once per day for orders with delivery_date = today
- **Tomorrow's Orders**: Notifies once per day for orders with delivery_date = tomorrow
- **Overdue Orders**: Notifies once per day for orders with delivery_date < today AND status != completed

Notification is sent only ONCE per event. Once sent, the `notified_*` flag is set to true.

### 2. Inventory Notifications
- **Low Stock**: quantity > 0 AND quantity <= 10 (default threshold)
- **Out of Stock**: quantity = 0

Notification is sent only ONCE per event. Once sent, the `low_stock_notified` or `out_of_stock_notified` flag is set to true.

## Database Schema

### Modified Tables

#### zakazlar (Orders)
```sql
ALTER TABLE zakazlar ADD COLUMN IF NOT EXISTS notified_today BOOLEAN DEFAULT false;
ALTER TABLE zakazlar ADD COLUMN IF NOT EXISTS notified_tomorrow BOOLEAN DEFAULT false;
ALTER TABLE zakazlar ADD COLUMN IF NOT EXISTS notified_overdue BOOLEAN DEFAULT false;
```

#### ombor (Inventory)
```sql
ALTER TABLE ombor ADD COLUMN IF NOT EXISTS low_stock_notified BOOLEAN DEFAULT false;
ALTER TABLE ombor ADD COLUMN IF NOT EXISTS out_of_stock_notified BOOLEAN DEFAULT false;
```

### New Tables

#### push_scheduler_logs
Tracks all scheduler executions for monitoring and debugging.

```sql
CREATE TABLE push_scheduler_logs (
  id UUID PRIMARY KEY,
  ran_at TIMESTAMP WITH TIME ZONE,
  orders_today INTEGER,
  orders_tomorrow INTEGER,
  orders_overdue INTEGER,
  low_stock_items INTEGER,
  out_of_stock_items INTEGER,
  notifications_sent INTEGER,
  status VARCHAR(20),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE
);
```

## API Endpoints

### 1. `/api/push-cron` - Scheduler Trigger
**Method**: GET
**Auth**: Bearer token via `CRON_SECRET` environment variable
**Response**: Execution summary with statistics

```bash
curl -X GET "https://app.example.com/api/push-cron" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response**:
```json
{
  "success": true,
  "message": "Notification scheduler completed",
  "summary": {
    "ordersToday": 3,
    "ordersTomorrow": 2,
    "ordersOverdue": 1,
    "lowStockItems": 5,
    "outOfStockItems": 2,
    "notificationsSent": 5
  },
  "timestamp": "2025-01-15T10:30:45Z"
}
```

### 2. `/api/push-debug` - System Status
**Method**: GET
**Auth**: Bearer token via `CRON_SECRET` environment variable
**Response**: Full system health report

```bash
curl -X GET "https://app.example.com/api/push-debug" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Response**:
```json
{
  "subscriptions": {
    "total": 150,
    "active": 145,
    "inactive": 5,
    "byPlatform": {
      "ios": 85,
      "android": 45,
      "web": 15
    }
  },
  "notificationState": {
    "orders": {
      "total": 42,
      "notifiedToday": 3,
      "notifiedTomorrow": 2,
      "notifiedOverdue": 1
    },
    "inventory": {
      "total": 156,
      "lowStockNotified": 5,
      "outOfStockNotified": 2
    }
  },
  "recentLogs": [...],
  "schedulerLogs": [...]
}
```

### 3. `/api/push-reset-notifications` - Reset State (Dev Only)
**Method**: POST
**Auth**: Bearer token via `CRON_SECRET` environment variable
**Use**: Development and testing only

```bash
curl -X POST "https://app.example.com/api/push-reset-notifications" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Setup Instructions

### 1. Environment Variables Required
```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your_public_key
VAPID_PRIVATE_KEY=your_private_key
CRON_SECRET=your_secret_token
```

### 2. Database Migrations
Run these SQL scripts in order:
1. `scripts/001_create_tables.sql` - Base tables
2. `scripts/002_create_triggers.sql` - Triggers
3. `scripts/003_push_notifications_migration.sql` - Push subscriptions
4. `scripts/004_enhanced_push_notifications.sql` - Notification state columns
5. `scripts/005_push_scheduler_logs.sql` - Scheduler logging

### 3. Cron Job Configuration

#### Using Vercel Cron (Recommended)
Add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/push-cron",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

#### Using External Cron Service (e.g., cron-job.org)
```
Schedule: Every 5 minutes
URL: https://your-domain.com/api/push-cron
Header: Authorization: Bearer YOUR_CRON_SECRET
Method: GET
```

## Platform-Specific Implementation

### Android (Full Support)
- ✅ Full Web Push API support
- ✅ Notifications work when app is closed
- ✅ Background sync available
- ✅ All notification actions supported
- ✅ Vibration and sound supported

### iOS (Limited Support)
- ⚠️ Push works ONLY if installed via "Add to Home Screen"
- ⚠️ NO background execution
- ⚠️ NO periodic sync
- ⚠️ Limited notification actions
- ⚠️ Must use simple payloads
- ✅ Vibration supported

**iOS Installation**:
1. User opens PWA in Safari
2. Tap Share → Add to Home Screen
3. App launches in standalone mode
4. Now can receive notifications

### Web (Chrome/Firefox)
- ✅ Standard Web Push API
- ✅ Requires explicit permission
- ✅ Full notification actions
- ✅ Service Worker required

## Debugging

### Check System Status
```bash
curl -X GET "https://your-domain.com/api/push-debug" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### View Recent Scheduler Logs
```sql
SELECT * FROM push_scheduler_logs 
ORDER BY ran_at DESC 
LIMIT 10;
```

### View Notification Logs
```sql
SELECT * FROM notification_logs 
ORDER BY created_at DESC 
LIMIT 20;
```

### Check Active Subscriptions
```sql
SELECT platform, COUNT(*) as count 
FROM push_subscriptions 
WHERE is_active = true 
GROUP BY platform;
```

### Reset Notifications (Testing Only)
```bash
curl -X POST "https://your-domain.com/api/push-reset-notifications" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Testing Checklist

### Android Testing
- [ ] Install PWA via Chrome's install prompt
- [ ] Subscribe to notifications (Settings → Notifications)
- [ ] Add test order with today's date
- [ ] Wait for cron trigger or manually call `/api/push-cron`
- [ ] Verify notification appears
- [ ] Close app and repeat
- [ ] Test with app in background

### iOS Testing
- [ ] Open PWA in Safari
- [ ] Add to Home Screen
- [ ] Subscribe to notifications
- [ ] Add test order
- [ ] Manually trigger `/api/push-cron`
- [ ] Verify notification appears (may be delayed)
- [ ] Close app and test again

### Inventory Testing
- [ ] Update product quantity to 0
- [ ] Manually call `/api/push-cron`
- [ ] Verify out-of-stock notification
- [ ] Update product quantity to 5 (below 10)
- [ ] Manually call `/api/push-cron`
- [ ] Verify low-stock notification

## Troubleshooting

### Notifications Not Sending
1. Check environment variables are set
2. Verify CRON_SECRET matches
3. Check `push_subscriptions` table has active entries
4. Review `notification_logs` for errors
5. Check browser console for subscription issues

### Duplicate Notifications
- System has 5-minute deduplication window
- If notifications still appear multiple times, check notification state flags in database
- Use `/api/push-reset-notifications` to reset state

### iOS Notifications Not Working
- Verify PWA is installed via "Add to Home Screen"
- Check if notification permission is granted
- iOS has higher delivery delay than Android
- Check `push_subscriptions.platform` has value 'ios'

### Android Notifications Delayed
- May be delayed if device is in doze mode
- Verify subscription is marked `is_active = true`
- Check for errors in `notification_logs`

## Performance Notes

- Scheduler runs every 5 minutes (configurable)
- Sends notifications asynchronously
- No blocking operations
- Database queries are indexed for performance
- Deduplication prevents unnecessary messages

## Security Notes

- All cron endpoints require `CRON_SECRET` token
- Never expose CRON_SECRET in client-side code
- Push subscriptions are server-side only
- Notification payloads are not encrypted (use HTTPS)
- Device tokens stored securely in Supabase
