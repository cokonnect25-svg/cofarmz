-- ============================================================================
-- FarmRent Database Schema - Complete Setup Script
-- ============================================================================
-- This script creates all tables, relationships, constraints, and sample data
-- for the FarmRent agricultural machinery rental platform
-- ============================================================================

-- Drop existing tables (if re-running script)
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS reservations CASCADE;
DROP TABLE IF EXISTS reel_comments CASCADE;
DROP TABLE IF EXISTS reel_likes CASCADE;
DROP TABLE IF EXISTS reels CASCADE;
DROP TABLE IF EXISTS machinery_unavailability CASCADE;
DROP TABLE IF EXISTS favorites CASCADE;
DROP TABLE IF EXISTS follows CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS crops CASCADE;
DROP TABLE IF EXISTS machinery CASCADE;
DROP TABLE IF EXISTS password_reset_tokens CASCADE;
DROP TABLE IF EXISTS session CASCADE;
DROP TABLE IF EXISTS account CASCADE;
DROP TABLE IF EXISTS verification CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;
DROP TABLE IF EXISTS roles CASCADE;

-- ============================================================================
-- 1. ROLES TABLE (Master Data)
-- ============================================================================
-- Defines all user roles with permissions
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (id, name, display_name, description, permissions) VALUES
(1, 'farmer', 'Farmer', 'Can list machinery, crops, rent equipment, and view crop waste opportunities', 
 '{"list_machinery": true, "rent_machinery": true, "list_crops": true, "view_crop_waste": true, "message": true}'::jsonb),
(2, 'buyer', 'Buyer', 'Can rent machinery and purchase crop waste', 
 '{"rent_machinery": true, "buy_crop_waste": true, "message": true}'::jsonb),
(3, 'admin', 'Admin', 'Full system access with moderation capabilities', 
 '{"admin": true, "moderate": true, "manage_users": true, "view_all": true}'::jsonb);

-- Reset sequence to start from 4 for new roles
ALTER SEQUENCE roles_id_seq RESTART WITH 4;

-- ============================================================================
-- 2. USER TABLE (Core Entity)
-- ============================================================================
-- Central user table for authentication and profile data
CREATE TABLE "user" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
  image TEXT,
  password TEXT,
  phone TEXT,
  gender VARCHAR(20),
  age INTEGER,

  -- Location data for nearby farmers feature
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  location TEXT,

  -- Role system (foreign key to roles table)
  role_id INTEGER NOT NULL DEFAULT 2 REFERENCES roles(id),
  role VARCHAR(20) NOT NULL DEFAULT 'buyer' CHECK (role IN ('farmer', 'buyer', 'admin')),
  is_farmer BOOLEAN DEFAULT FALSE,

  -- Timestamps
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_user_role_id ON "user"(role_id);
CREATE INDEX idx_user_location ON "user"(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_user_email ON "user"(email);

-- ============================================================================
-- 3. AUTHENTICATION TABLES (Better Auth)
-- ============================================================================

-- Account table - OAuth providers and password authentication
CREATE TABLE account (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  scope TEXT,
  password TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE("providerId", "accountId")
);

CREATE INDEX idx_account_userId ON account("userId");

-- Session table - Active user sessions
CREATE TABLE session (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_session_userId ON session("userId");
CREATE INDEX idx_session_token ON session(token);

-- Verification table - Email verification tokens
CREATE TABLE verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  user_id TEXT NOT NULL PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_token ON password_reset_tokens(token);

-- ============================================================================
-- 4. MACHINERY TABLE (Core Feature)
-- ============================================================================
-- Agricultural equipment available for rent
CREATE TABLE machinery (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  year INTEGER,
  power TEXT,
  drive TEXT,
  fuel TEXT,
  daily_rate NUMERIC(10, 2),
  description TEXT,
  image_url TEXT,
  location TEXT,
  is_unavailable BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_machinery_owner ON machinery(owner_id);
CREATE INDEX idx_machinery_available ON machinery(is_unavailable) WHERE is_unavailable = FALSE;

-- ============================================================================
-- 5. MACHINERY UNAVAILABILITY (Feature)
-- ============================================================================
-- Track date ranges when machinery is unavailable
CREATE TABLE machinery_unavailability (
  id SERIAL PRIMARY KEY,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_globally_unavailable BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_unavailability_machinery ON machinery_unavailability(machinery_id);
CREATE INDEX idx_unavailability_dates ON machinery_unavailability(start_date, end_date);

-- ============================================================================
-- 6. CROPS TABLE (Farmer Feature)
-- ============================================================================
-- Crops grown by farmers, including crop waste listings
CREATE TABLE crops (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  crop_name TEXT NOT NULL,
  years_of_experience INTEGER,
  expertise_level TEXT,
  expected_yield_date DATE,
  expected_yield_quantity NUMERIC(10, 2),
  expected_yield_quantity_uom VARCHAR(50) DEFAULT 'kg',
  crop_type VARCHAR CHECK (crop_type IN ('grow', 'waste')) DEFAULT 'grow',
  is_crop_waste BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_crops_user ON crops(user_id);
CREATE INDEX idx_crops_waste ON crops(is_crop_waste) WHERE is_crop_waste = TRUE;

-- ============================================================================
-- 7. RESERVATIONS TABLE (Booking System)
-- ============================================================================
-- Equipment rental bookings
CREATE TABLE reservations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  machinery_name TEXT NOT NULL,
  owner_id TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  daily_rate NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'rejected')),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_reservations_user ON reservations(user_id);
CREATE INDEX idx_reservations_machinery ON reservations(machinery_id);
CREATE INDEX idx_reservations_owner ON reservations(owner_id);
CREATE INDEX idx_reservations_status ON reservations(status);

-- ============================================================================
-- 8. REVIEWS TABLE (Rating System)
-- ============================================================================
-- Reviews for machinery after rental
CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  reservation_id INTEGER NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(reservation_id) -- One review per reservation
);

CREATE INDEX idx_reviews_machinery ON reviews(machinery_id);
CREATE INDEX idx_reviews_user ON reviews(user_id);

-- ============================================================================
-- 9. FAVORITES TABLE (User Feature)
-- ============================================================================
-- Users can favorite machinery for quick access
CREATE TABLE favorites (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, machinery_id)
);

CREATE INDEX idx_favorites_user ON favorites(user_id);

-- ============================================================================
-- 10. FOLLOWS TABLE (Social Feature)
-- ============================================================================
-- Users can follow other farmers
CREATE TABLE follows (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, following_id),
  CHECK (user_id != following_id) -- Can't follow yourself
);

CREATE INDEX idx_follows_user ON follows(user_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- ============================================================================
-- 11. MESSAGES TABLE (Chat Feature)
-- ============================================================================
-- Direct messaging between users
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_receiver ON messages(receiver_id);
CREATE INDEX idx_messages_conversation ON messages(sender_id, receiver_id);

-- ============================================================================
-- 12. REELS TABLE (Social Media Feature)
-- ============================================================================
-- Short-form video content (like Instagram Reels)
CREATE TABLE reels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  thumbnail_url TEXT,
  views INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reels_user ON reels(user_id);
CREATE INDEX idx_reels_created ON reels(created_at DESC);

-- Reel likes
CREATE TABLE reel_likes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, reel_id)
);

CREATE INDEX idx_reel_likes_reel ON reel_likes(reel_id);

-- Reel comments
CREATE TABLE reel_comments (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_reel_comments_reel ON reel_comments(reel_id);

-- ============================================================================
-- SAMPLE DATA (For Testing)
-- ============================================================================

-- Sample users
INSERT INTO "user" (id, name, email, "emailVerified", role_id, role, is_farmer, phone, location, latitude, longitude, password) VALUES
('user_farmer1', 'Mahesh Kumar', 'mahesh@farmrent.com', true, 1, 'farmer', true, '+919876543210', 'Bangalore, Karnataka', 12.9716, 77.5946, '$2b$10$dummyhash1'),
('user_farmer2', 'Ramesh Patel', 'ramesh@farmrent.com', true, 1, 'farmer', true, '+919876543211', 'Ahmedabad, Gujarat', 23.0225, 72.5714, '$2b$10$dummyhash2'),
('user_buyer1', 'Suresh Singh', 'suresh@farmrent.com', true, 2, 'buyer', false, '+919876543212', 'Mumbai, Maharashtra', 19.0760, 72.8777, '$2b$10$dummyhash3'),
('user_admin1', 'Admin User', 'admin@farmrent.com', true, 3, 'admin', false, '+919876543213', 'Bangalore, Karnataka', 12.9716, 77.5946, '$2b$10$dummyhash4');

-- Sample machinery
INSERT INTO machinery (id, owner_id, name, model, year, power, drive, fuel, daily_rate, description, image_url, location, is_unavailable) VALUES
('mach_1', 'user_farmer1', 'John Deere Tractor', '5075E', 2022, '75 HP', '4WD', 'Diesel', 2500, 'Well-maintained tractor suitable for all farming operations', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', 'Bangalore, Karnataka', false),
('mach_2', 'user_farmer1', 'Rotavator', 'Mahindra RT-200', 2021, '30 HP', '2WD', 'Diesel', 1200, 'Soil tilling equipment for seedbed preparation', 'https://images.unsplash.com/photo-1589229085138-f7ec58e7e1a4?w=800', 'Bangalore, Karnataka', false),
('mach_3', 'user_farmer2', 'Combine Harvester', 'New Holland TC5.90', 2023, '90 HP', '4WD', 'Diesel', 5000, 'Multi-crop harvester with advanced features', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800', 'Ahmedabad, Gujarat', false);

-- Sample crops
INSERT INTO crops (user_id, crop_name, years_of_experience, expertise_level, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, crop_type, is_crop_waste) VALUES
('user_farmer1', 'Wheat', 10, 'Expert', '2025-04-15', 5000, 'kg', 'grow', false),
('user_farmer1', 'Rice Straw', 10, 'Expert', '2025-03-01', 2000, 'kg', 'waste', true),
('user_farmer2', 'Cotton', 8, 'Advanced', '2025-05-20', 3000, 'kg', 'grow', false);

-- Sample reservations
INSERT INTO reservations (user_id, machinery_id, machinery_name, owner_id, start_date, end_date, total_days, daily_rate, total_price, status) VALUES
('user_buyer1', 'mach_1', 'John Deere Tractor', 'user_farmer1', '2025-02-10', '2025-02-12', 3, 2500, 7500, 'confirmed'),
('user_buyer1', 'mach_2', 'Rotavator', 'user_farmer1', '2025-01-20', '2025-01-22', 3, 1200, 3600, 'completed');

-- Sample reviews
INSERT INTO reviews (user_id, machinery_id, reservation_id, rating, review_text) VALUES
('user_buyer1', 'mach_2', 2, 5, 'Excellent equipment! Well-maintained and easy to operate.');

-- Sample follows
INSERT INTO follows (user_id, following_id) VALUES
('user_buyer1', 'user_farmer1'),
('user_buyer1', 'user_farmer2');

-- ============================================================================
-- DATABASE VIEWS (Optional - For Complex Queries)
-- ============================================================================

-- View: Machinery with owner details and ratings
CREATE OR REPLACE VIEW machinery_with_details AS
SELECT 
  m.*,
  u.name as owner_name,
  u.phone as owner_phone,
  u.image as owner_image,
  COALESCE(AVG(r.rating), 0) as average_rating,
  COUNT(DISTINCT r.id) as review_count,
  COUNT(DISTINCT res.id) as total_bookings
FROM machinery m
JOIN "user" u ON m.owner_id = u.id
LEFT JOIN reviews r ON m.id = r.machinery_id
LEFT JOIN reservations res ON m.id = res.machinery_id
GROUP BY m.id, u.name, u.phone, u.image;

-- View: User profile with stats
CREATE OR REPLACE VIEW user_profile_stats AS
SELECT 
  u.*,
  r.name as role_name,
  r.display_name as role_display_name,
  r.permissions as role_permissions,
  COUNT(DISTINCT m.id) as machinery_count,
  COUNT(DISTINCT c.id) as crops_count,
  COUNT(DISTINCT f1.id) as followers_count,
  COUNT(DISTINCT f2.id) as following_count,
  COUNT(DISTINCT res.id) as total_reservations
FROM "user" u
JOIN roles r ON u.role_id = r.id
LEFT JOIN machinery m ON u.id = m.owner_id
LEFT JOIN crops c ON u.id = c.user_id
LEFT JOIN follows f1 ON u.id = f1.following_id
LEFT JOIN follows f2 ON u.id = f2.user_id
LEFT JOIN reservations res ON u.id = res.user_id
GROUP BY u.id, r.name, r.display_name, r.permissions;

-- ============================================================================
-- USEFUL QUERIES (Copy-paste ready)
-- ============================================================================

-- Get all farmers with their machinery count
-- SELECT * FROM user_profile_stats WHERE role_name = 'farmer';

-- Get available machinery near a location (example: Bangalore)
-- SELECT * FROM machinery_with_details WHERE is_unavailable = FALSE ORDER BY average_rating DESC;

-- Get all bookings for a user
-- SELECT * FROM reservations WHERE user_id = 'your_user_id' ORDER BY created_at DESC;

-- Get crop waste available for buyers
-- SELECT c.*, u.name as farmer_name, u.phone FROM crops c JOIN "user" u ON c.user_id = u.id WHERE c.is_crop_waste = TRUE;

-- Get conversation messages between two users
-- SELECT * FROM messages WHERE (sender_id = 'user1' AND receiver_id = 'user2') OR (sender_id = 'user2' AND receiver_id = 'user1') ORDER BY created_at ASC;

-- ============================================================================
-- CLEANUP & MAINTENANCE QUERIES
-- ============================================================================

-- Delete expired password reset tokens
-- DELETE FROM password_reset_tokens WHERE expires_at < NOW();

-- Delete expired sessions
-- DELETE FROM session WHERE expiresAt < NOW();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
