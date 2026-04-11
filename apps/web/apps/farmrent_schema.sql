-- FarmRent Database Schema
-- PostgreSQL Database Schema for FarmRent Agricultural Marketplace

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  permissions JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (name, display_name, description, permissions) VALUES
('farmer', 'Farmer', 'Agricultural producer who can list machinery and crops', '{"can_list_machinery": true, "can_list_crops": true, "can_rent_machinery": true, "can_view_crop_waste": true}'::jsonb),
('buyer', 'Buyer', 'Agricultural waste buyer who can purchase crop waste', '{"can_rent_machinery": true, "can_buy_crop_waste": true, "can_message": true}'::jsonb),
('admin', 'Admin', 'Platform administrator with full access', '{"can_moderate": true, "can_manage_users": true, "can_view_analytics": true, "full_access": true}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Users table
CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  "emailVerified" BOOLEAN DEFAULT FALSE,
  image TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  latitude NUMERIC(10, 8),
  longitude NUMERIC(11, 8),
  location TEXT,
  role_id INTEGER NOT NULL DEFAULT 2 REFERENCES roles(id) ON DELETE SET NULL,
  password TEXT,
  phone TEXT,
  gender VARCHAR(20),
  age INTEGER
);

-- Account table (for OAuth)
CREATE TABLE IF NOT EXISTS account (
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
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE("providerId", "accountId")
);

-- Session table
CREATE TABLE IF NOT EXISTS session (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  "updatedAt" TIMESTAMP DEFAULT NOW()
);

-- Verification table (for email verification)
CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  UNIQUE(identifier, value)
);

-- Password Reset Tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (user_id, token)
);

-- Crops table (for farmers listing their crops)
CREATE TABLE IF NOT EXISTS crops (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  crop_name TEXT NOT NULL,
  years_of_experience INTEGER,
  expertise_level TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expected_yield_date DATE,
  expected_yield_quantity NUMERIC(10, 2),
  expected_yield_quantity_uom VARCHAR(50),
  crop_type VARCHAR(10) CHECK (crop_type IN ('grow', 'buy')),
  is_crop_waste BOOLEAN DEFAULT FALSE
);

-- Machinery table (for farmers listing their equipment)
CREATE TABLE IF NOT EXISTS machinery (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  model TEXT,
  year INTEGER,
  power TEXT,
  drive TEXT,
  fuel TEXT,
  daily_rate NUMERIC(10, 2) NOT NULL,
  description TEXT,
  image_url TEXT,
  location TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  is_unavailable BOOLEAN DEFAULT FALSE
);

-- Machinery Unavailability
CREATE TABLE IF NOT EXISTS machinery_unavailability (
  id SERIAL PRIMARY KEY,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_globally_unavailable BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Reservations table
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  machinery_name TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  daily_rate NUMERIC(10, 2) NOT NULL,
  total_price NUMERIC(10, 2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed', 'cancelled')),
  created_at TIMESTAMP DEFAULT NOW(),
  owner_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  reservation_id INTEGER REFERENCES reservations(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, machinery_id, reservation_id)
);

-- Favorites table
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT NOT NULL REFERENCES machinery(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, machinery_id)
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id SERIAL PRIMARY KEY,
  sender_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  machinery_id TEXT REFERENCES machinery(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Follows table (farmers can follow each other)
CREATE TABLE IF NOT EXISTS follows (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, following_id),
  CHECK (user_id != following_id)
);

-- Reels table (short video content)
CREATE TABLE IF NOT EXISTS reels (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  caption TEXT,
  thumbnail_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reel Likes table
CREATE TABLE IF NOT EXISTS reel_likes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, reel_id)
);

-- Reel Comments table
CREATE TABLE IF NOT EXISTS reel_comments (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  reel_id TEXT NOT NULL REFERENCES reels(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_email ON "user"(email);
CREATE INDEX IF NOT EXISTS idx_user_role_id ON "user"(role_id);
CREATE INDEX IF NOT EXISTS idx_user_location ON "user"(latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_machinery_owner ON machinery(owner_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_reservations_machinery ON reservations(machinery_id);
CREATE INDEX IF NOT EXISTS idx_reservations_dates ON reservations(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_follows_user ON follows(user_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_crops_user ON crops(user_id);
CREATE INDEX IF NOT EXISTS idx_reels_user ON reels(user_id);

-- Sample users (role_id: 1=farmer, 2=buyer, 3=admin)
INSERT INTO "user" (id, name, email, "emailVerified", image, latitude, longitude, location, role_id, phone, gender, age) VALUES
('user1', 'Rajesh Kumar', 'rajesh@example.com', TRUE, 'https://i.pravatar.cc/150?img=12', 13.0827, 80.2707, 'Chennai, Tamil Nadu', 1, '+91 98765 43210', 'male', 45),
('user2', 'Priya Sharma', 'priya@example.com', TRUE, 'https://i.pravatar.cc/150?img=5', 28.7041, 77.1025, 'Delhi', 2, '+91 98765 43211', 'female', 32),
('user3', 'Mahesh Patil', 'mahesh@example.com', TRUE, 'https://i.pravatar.cc/150?img=33', 18.5204, 73.8567, 'Pune, Maharashtra', 1, '+91 98765 43212', 'male', 38),
('user4', 'Anita Desai', 'anita@example.com', TRUE, 'https://i.pravatar.cc/150?img=9', 23.0225, 72.5714, 'Ahmedabad, Gujarat', 2, '+91 98765 43213', 'female', 29),
('demo_user', 'Demo User', 'demo@appgen.com', TRUE, 'https://i.pravatar.cc/150?img=68', 12.9716, 77.5946, 'Bangalore, Karnataka', 1, '+91 98765 43214', 'male', 35)
ON CONFLICT (id) DO NOTHING;

-- Sample crops
INSERT INTO crops (user_id, crop_name, years_of_experience, expertise_level, crop_type, expected_yield_date, expected_yield_quantity, expected_yield_quantity_uom, is_crop_waste) VALUES
('user1', 'Rice', 15, 'expert', 'grow', '2024-09-15', 5000, 'kg', FALSE),
('user1', 'Wheat', 12, 'expert', 'grow', '2024-08-20', 3000, 'kg', FALSE),
('user3', 'Cotton', 8, 'intermediate', 'grow', '2024-10-10', 2000, 'kg', FALSE),
('user3', 'Sugarcane', 10, 'expert', 'grow', '2024-11-05', 8000, 'kg', FALSE),
('demo_user', 'Corn', 6, 'intermediate', 'grow', '2024-07-25', 4000, 'kg', FALSE)
ON CONFLICT DO NOTHING;

-- Sample machinery
INSERT INTO machinery (id, owner_id, name, model, year, power, drive, fuel, daily_rate, description, image_url, location, is_unavailable) VALUES
('mach1', 'user1', 'John Deere Tractor', '5075E', 2020, '75 HP', '4WD', 'Diesel', 1500.00, 'Powerful tractor suitable for heavy-duty farming tasks', 'https://images.unsplash.com/photo-1581578949510-fa7315c4c350?w=800', 'Chennai, Tamil Nadu', FALSE),
('mach2', 'user3', 'Mahindra Harvester', '595 DI', 2019, '90 HP', '2WD', 'Diesel', 2000.00, 'Efficient harvester for rice and wheat crops', 'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=800', 'Pune, Maharashtra', FALSE),
('mach3', 'demo_user', 'Kubota Cultivator', 'M7040', 2021, '65 HP', '4WD', 'Diesel', 1200.00, 'Versatile cultivator for small to medium farms', 'https://images.unsplash.com/photo-1589041127168-9f86b0b2c1c8?w=800', 'Bangalore, Karnataka', FALSE),
('mach4', 'user1', 'Rotavator', 'RT-150', 2022, '50 HP', 'PTO', 'Diesel', 800.00, 'Soil preparation equipment for seedbed preparation', 'https://images.unsplash.com/photo-1596461307041-8c86c3c1524c?w=800', 'Chennai, Tamil Nadu', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Sample reservations
INSERT INTO reservations (user_id, machinery_id, machinery_name, start_date, end_date, total_days, daily_rate, total_price, status, owner_id) VALUES
('user2', 'mach1', 'John Deere Tractor', '2024-06-15', '2024-06-18', 3, 1500.00, 4500.00, 'completed', 'user1'),
('user4', 'mach2', 'Mahindra Harvester', '2024-07-01', '2024-07-05', 4, 2000.00, 8000.00, 'approved', 'user3'),
('user2', 'mach3', 'Kubota Cultivator', '2024-07-10', '2024-07-12', 2, 1200.00, 2400.00, 'pending', 'demo_user')
ON CONFLICT DO NOTHING;

-- Sample messages
INSERT INTO messages (sender_id, receiver_id, machinery_id, message) VALUES
('user2', 'user1', 'mach1', 'Hi, is this tractor available next week?'),
('user1', 'user2', 'mach1', 'Yes, it is available. What dates do you need it?'),
('user4', 'user3', 'mach2', 'Can I get a discount for a week-long rental?')
ON CONFLICT DO NOTHING;

-- Sample reviews
INSERT INTO reviews (user_id, machinery_id, reservation_id, rating, review_text) VALUES
('user2', 'mach1', 1, 5, 'Excellent tractor! Worked perfectly for my farm. Highly recommend.'),
('user4', 'mach2', 2, 4, 'Good harvester, but fuel consumption was higher than expected.')
ON CONFLICT DO NOTHING;

-- Sample favorites
INSERT INTO favorites (user_id, machinery_id) VALUES
('user2', 'mach1'),
('user2', 'mach3'),
('user4', 'mach2')
ON CONFLICT DO NOTHING;

-- Sample follows
INSERT INTO follows (user_id, following_id) VALUES
('user2', 'user1'),
('user2', 'user3'),
('user4', 'user1'),
('user4', 'demo_user')
ON CONFLICT DO NOTHING;

-- Sample reels
INSERT INTO reels (id, user_id, video_url, caption, thumbnail_url) VALUES
('reel1', 'user1', 'https://example.com/videos/farming-tips.mp4', 'Best practices for rice cultivation #farming #agriculture', 'https://images.unsplash.com/photo-1574943320219-553eb213f72d?w=800'),
('reel2', 'user3', 'https://example.com/videos/cotton-harvest.mp4', 'Cotton harvesting season in full swing! #cotton #harvest', 'https://images.unsplash.com/photo-1601597111158-2fceff292cdc?w=800')
ON CONFLICT (id) DO NOTHING;

-- Sample reel likes
INSERT INTO reel_likes (user_id, reel_id) VALUES
('user2', 'reel1'),
('user4', 'reel1'),
('user2', 'reel2')
ON CONFLICT DO NOTHING;

-- Sample reel comments
INSERT INTO reel_comments (user_id, reel_id, comment) VALUES
('user2', 'reel1', 'Very helpful tips! Thank you for sharing.'),
('user4', 'reel1', 'Learned something new today!')
ON CONFLICT DO NOTHING;
