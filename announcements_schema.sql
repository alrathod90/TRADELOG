/**
 * Database schema for announcements table
 * Run this as a migration in your Neon database
 */

-- Create announcements table with smart fields
CREATE TABLE IF NOT EXISTS announcements (
  -- Basic identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  symbol VARCHAR(20) NOT NULL,
  announcement_date DATE NOT NULL,
  
  -- Original content
  description TEXT,
  pdf_url TEXT,
  nse_url TEXT,
  
  -- Extracted text from PDF
  extracted_text TEXT,
  
  -- Smart fields (from announcementProcessor.js)
  category VARCHAR(50) DEFAULT 'unknown',
  smart_summary TEXT,
  sentiment VARCHAR(20) DEFAULT 'NEUTRAL',
  sentiment_score NUMERIC(3, 1) DEFAULT 0,
  impact_level VARCHAR(20) DEFAULT 'LOW',
  impact_score NUMERIC(2, 0) DEFAULT 2,
  
  -- Processing metadata
  processed_at TIMESTAMP WITH TIME ZONE,
  raw_announcement JSONB,
  
  -- Tracking
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Deduplication
  announcement_key VARCHAR(255) UNIQUE,
  
  -- Indexes for fast queries
  CONSTRAINT announcements_symbol_date_idx UNIQUE (symbol, announcement_date, announcement_key)
);

CREATE INDEX IF NOT EXISTS announcements_symbol_idx ON announcements(symbol);
CREATE INDEX IF NOT EXISTS announcements_category_idx ON announcements(category);
CREATE INDEX IF NOT EXISTS announcements_impact_idx ON announcements(impact_level);
CREATE INDEX IF NOT EXISTS announcements_sentiment_idx ON announcements(sentiment);
CREATE INDEX IF NOT EXISTS announcements_date_idx ON announcements(announcement_date DESC);
CREATE INDEX IF NOT EXISTS announcements_processed_idx ON announcements(processed_at DESC);

-- Create alerts_sent table to track which alerts have been sent
CREATE TABLE IF NOT EXISTS alerts_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
  sent_to VARCHAR(255), -- chat_id, email, webhook, etc.
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT alerts_sent_unique UNIQUE (announcement_id, sent_to)
);

CREATE INDEX IF NOT EXISTS alerts_sent_announcement_idx ON alerts_sent(announcement_id);

-- Note: Run this SQL in your Neon dashboard or via psql:
-- psql $DATABASE_URL < announcements_schema.sql
