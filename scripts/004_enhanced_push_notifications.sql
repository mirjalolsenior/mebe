-- Enhanced Push Notifications Tables for Production

-- Add notification state tracking to existing tables
ALTER TABLE IF EXISTS push_subscriptions
ADD COLUMN IF NOT EXISTS platform VARCHAR(20) CHECK (platform IN ('ios', 'android', 'web')),
ADD COLUMN IF NOT EXISTS browser VARCHAR(50),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS last_verified TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_successful_push TIMESTAMP WITH TIME ZONE;

ALTER TABLE IF EXISTS zakazlar
ADD COLUMN IF NOT EXISTS notified_today BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_tomorrow BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS notified_overdue BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS ombor
ADD COLUMN IF NOT EXISTS low_stock_notified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS out_of_stock_notified BOOLEAN DEFAULT false;

-- Notification event tracking to prevent duplicate notifications
CREATE TABLE IF NOT EXISTS notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('order_today', 'order_tomorrow', 'order_overdue', 'low_stock', 'out_of_stock')),
  entity_id UUID NOT NULL,
  notification_sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(entity_type, entity_id)
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_zakazlar_notified_today ON zakazlar(notified_today);
CREATE INDEX IF NOT EXISTS idx_zakazlar_notified_tomorrow ON zakazlar(notified_tomorrow);
CREATE INDEX IF NOT EXISTS idx_zakazlar_notified_overdue ON zakazlar(notified_overdue);
CREATE INDEX IF NOT EXISTS idx_ombor_low_stock_notified ON ombor(low_stock_notified);
CREATE INDEX IF NOT EXISTS idx_ombor_out_of_stock_notified ON ombor(out_of_stock_notified);
CREATE INDEX IF NOT EXISTS idx_notification_events_entity ON notification_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_notification_events_sent ON notification_events(notification_sent_at DESC);
