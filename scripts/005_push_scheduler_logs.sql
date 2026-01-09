-- Push Scheduler Logs Table for monitoring and debugging
CREATE TABLE IF NOT EXISTS push_scheduler_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at TIMESTAMP WITH TIME ZONE NOT NULL,
  orders_today INTEGER DEFAULT 0,
  orders_tomorrow INTEGER DEFAULT 0,
  orders_overdue INTEGER DEFAULT 0,
  low_stock_items INTEGER DEFAULT 0,
  out_of_stock_items INTEGER DEFAULT 0,
  notifications_sent INTEGER DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('completed', 'failed', 'partial')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for querying recent scheduler executions
CREATE INDEX IF NOT EXISTS idx_push_scheduler_logs_ran_at ON push_scheduler_logs(ran_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_scheduler_logs_status ON push_scheduler_logs(status);
