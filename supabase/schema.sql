-- ============================================
-- WAREHOUSE CENTER — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- SAP Import Tables
-- =====================

-- Pick Report (LTAP/LTAK)
CREATE TABLE IF NOT EXISTS pick_data (
  id BIGSERIAL PRIMARY KEY,
  transfer_order TEXT,
  material TEXT,
  delivery TEXT,
  qty NUMERIC DEFAULT 0,
  source_bin TEXT,
  queue TEXT DEFAULT 'N/A',
  removal_su TEXT DEFAULT '',
  confirmation_date DATE,
  confirmation_time TEXT,
  "user" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pick_material ON pick_data(material);
CREATE INDEX idx_pick_delivery ON pick_data(delivery);
CREATE INDEX idx_pick_date ON pick_data(confirmation_date);

-- Queue (LTAK)
CREATE TABLE IF NOT EXISTS queue_data (
  id BIGSERIAL PRIMARY KEY,
  transfer_order TEXT,
  queue TEXT,
  sd_document TEXT,
  confirmation_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_queue_to ON queue_data(transfer_order);

-- VEKP — Handling Units
CREATE TABLE IF NOT EXISTS vekp_data (
  id BIGSERIAL PRIMARY KEY,
  internal_hu TEXT,
  external_hu TEXT,
  parent_hu TEXT,
  generated_delivery TEXT,
  packaging_material TEXT,
  total_weight NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vekp_hu ON vekp_data(internal_hu);
CREATE INDEX idx_vekp_delivery ON vekp_data(generated_delivery);

-- VEPO — Packed Quantities
CREATE TABLE IF NOT EXISTS vepo_data (
  id BIGSERIAL PRIMARY KEY,
  internal_hu TEXT,
  material TEXT,
  packed_qty NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vepo_hu ON vepo_data(internal_hu);

-- MARM — Material Master (Alternative Units, Weights, Dimensions)
CREATE TABLE IF NOT EXISTS marm_data (
  id BIGSERIAL PRIMARY KEY,
  material TEXT,
  alt_unit TEXT,
  numerator NUMERIC DEFAULT 0,
  gross_weight NUMERIC DEFAULT 0,
  weight_unit TEXT DEFAULT 'KG',
  length NUMERIC DEFAULT 0,
  width NUMERIC DEFAULT 0,
  height NUMERIC DEFAULT 0,
  dimension_unit TEXT DEFAULT 'CM',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_marm_material ON marm_data(material);

-- LX03 — Bin Master / Capacity
CREATE TABLE IF NOT EXISTS lx03_data (
  id BIGSERIAL PRIMARY KEY,
  storage_bin TEXT,
  storage_type TEXT,
  bin_type TEXT,
  material TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lx03_bin ON lx03_data(storage_bin);

-- LT10 — Current Stock Levels
CREATE TABLE IF NOT EXISTS lt10_data (
  id BIGSERIAL PRIMARY KEY,
  storage_bin TEXT,
  bin_type TEXT,
  material TEXT,
  available_stock NUMERIC DEFAULT 0,
  last_movement DATE,
  storage_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lt10_bin ON lt10_data(storage_bin);
CREATE INDEX idx_lt10_material ON lt10_data(material);

-- OE-Times — Packing Times
CREATE TABLE IF NOT EXISTS oe_times_data (
  id BIGSERIAL PRIMARY KEY,
  dn_number TEXT,
  process_time TEXT,
  customer TEXT,
  material TEXT,
  klt TEXT,
  palety TEXT,
  cartons TEXT,
  shift TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oe_dn ON oe_times_data(dn_number);

-- Categories
CREATE TABLE IF NOT EXISTS categories_data (
  id BIGSERIAL PRIMARY KEY,
  delivery TEXT,
  kategorie TEXT,
  art TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIKP
CREATE TABLE IF NOT EXISTS likp_data (
  id BIGSERIAL PRIMARY KEY,
  delivery TEXT,
  shipping_point TEXT,
  receiving_point TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Manual Master Data (box size overrides)
CREATE TABLE IF NOT EXISTS manual_master (
  id BIGSERIAL PRIMARY KEY,
  material TEXT,
  packaging_desc TEXT,
  box_sizes JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- Operational Tables
-- =====================

-- Deliveries (order tracking)
CREATE TABLE IF NOT EXISTS deliveries (
  id BIGSERIAL PRIMARY KEY,
  delivery_no TEXT UNIQUE,
  status INTEGER DEFAULT 10,
  del_type TEXT,
  loading_date DATE,
  forwarding_agent TEXT,
  ship_to_party TEXT,
  total_weight NUMERIC DEFAULT 0,
  bill_of_lading TEXT,
  country TEXT,
  order_type TEXT,
  note TEXT DEFAULT '',
  is_archived BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_del_no ON deliveries(delivery_no);
CREATE INDEX idx_del_status ON deliveries(status);
CREATE INDEX idx_del_date ON deliveries(loading_date);

-- Import Log
CREATE TABLE IF NOT EXISTS import_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  row_count INTEGER DEFAULT 0,
  mode TEXT DEFAULT 'append',
  imported_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'open',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- RLS Policies (basic — tighten with auth later)
-- =====================

-- For now, allow all access (no auth)
ALTER TABLE pick_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE queue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE vekp_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE vepo_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE marm_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE lx03_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE lt10_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE oe_times_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE likp_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon key (tighten with auth in Phase 5)
CREATE POLICY "Allow all for anon" ON pick_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON queue_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON vekp_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON vepo_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON marm_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON lx03_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON lt10_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON oe_times_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON categories_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON likp_data FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON manual_master FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON deliveries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON import_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tickets FOR ALL USING (true) WITH CHECK (true);
