-- Add new columns to purchase_orders table for enhanced tracking
ALTER TABLE purchase_orders 
ADD COLUMN IF NOT EXISTS subtotal integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_amount integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_by text,
ADD COLUMN IF NOT EXISTS created_by_name text,
ADD COLUMN IF NOT EXISTS submitted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS submitted_by text,
ADD COLUMN IF NOT EXISTS confirmed_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS delivered_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS cancellation_reason text;

-- Update existing records to have subtotal and tax_amount
UPDATE purchase_orders 
SET subtotal = ROUND(total_amount / 1.1),
    tax_amount = total_amount - ROUND(total_amount / 1.1)
WHERE subtotal = 0;

-- Update status values from 'sent' and 'received' to match new schema
UPDATE purchase_orders SET status = 'submitted' WHERE status = 'sent';
UPDATE purchase_orders SET status = 'delivered' WHERE status = 'received';

-- Add quantity_received column to purchase_order_items
ALTER TABLE purchase_order_items 
ADD COLUMN IF NOT EXISTS quantity_received numeric DEFAULT 0;

-- Rename quantity to quantity_ordered for clarity
ALTER TABLE purchase_order_items 
RENAME COLUMN quantity TO quantity_ordered;