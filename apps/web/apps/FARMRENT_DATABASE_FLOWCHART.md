# FarmRent Database Architecture & Flow

## 📊 Entity Relationship Diagram (ERD)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATABASE ARCHITECTURE                              │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐
│     ROLES       │ ◄──────────────────────────────────────┐
├─────────────────┤                                         │
│ id (PK)         │                                         │
│ name (UNIQUE)   │                                         │
│ display_name    │                                         │
│ description     │                                         │
│ permissions     │                                         │
└────────┬────────┘                                         │
         │                                                  │
         │ 1:N                                              │
         ▼                                                  │
┌─────────────────┐                                         │
│      USER       │                                         │
├─────────────────┤                                         │
│ id (PK)         │◄────┐                                   │
│ name            │     │                                   │
│ email (UNIQUE)  │     │                                   │
│ role_id (FK)────┼─────┘ role_id REFERENCES roles(id)
│ phone           │
│ location        │
│ latitude        │
│ longitude       │
└────────┬────────┘
         │
         │ 1:N (user owns multiple entities)
         │
         ├──────────────────────────┬────────────────────────┬────────────────┐
         │                          │                        │                │
         ▼                          ▼                        ▼                ▼
┌────────────────┐        ┌─────────────────┐     ┌─────────────┐   ┌──────────────┐
│   MACHINERY    │        │      CROPS      │     │   REELS     │   │   FOLLOWS    │
├────────────────┤        ├─────────────────┤     ├─────────────┤   ├──────────────┤
│ id (PK)        │        │ id (PK)         │     │ id (PK)     │   │ id (PK)      │
│ owner_id (FK)──┼──┐     │ user_id (FK)────┼─┐   │ user_id(FK)─┼┐  │ user_id (FK)─┼┐
│ name           │  │     │ crop_name       │ │   │ video_url   ││  │ following_id ││
│ model          │  │     │ crop_type       │ │   │ caption     ││  │              ││
│ daily_rate     │  │     │ is_crop_waste   │ │   └─────┬───────┘│  └──────────────┘│
│ location       │  │     │ expected_yield  │ │         │        │                   │
│ is_unavailable │  │     └─────────────────┘ │         │        │                   │
└────────┬───────┘  │                         │         │        │                   │
         │          │                         │         │        │                   │
         │          └─────────────────────────┼─────────┼────────┘                   │
         │                                    │         │                            │
         │                                    │         │                            │
         ├────────────┬──────────────┬────────┤         │                            │
         │            │              │        │         │                            │
         ▼            ▼              ▼        ▼         ▼                            ▼
┌─────────────┐ ┌──────────────┐ ┌─────────────┐ ┌──────────────┐           ┌──────────────┐
│ RESERVATIONS│ │  FAVORITES   │ │   REVIEWS   │ │  REEL_LIKES  │           │   MESSAGES   │
├─────────────┤ ├──────────────┤ ├─────────────┤ ├──────────────┤           ├──────────────┤
│ id (PK)     │ │ id (PK)      │ │ id (PK)     │ │ id (PK)      │           │ id (PK)      │
│ user_id(FK)─┼┐│ user_id(FK)──┼┐│ user_id(FK)─┼┐│ user_id (FK)─┼┐          │ sender_id(FK)┼┐
│machinery_id ││└─machinery_id││└─machinery_id││└─ reel_id(FK)──┼│          │receiver_id   ││
│   (FK)──────┼┘    (FK)──────┼┘    (FK)──────┼┘               ││          │   (FK)───────┼┘
│ owner_id    │                │reservation_id │                ││          │ machinery_id │
│ start_date  │                │   (FK)────────┼─┐              ││          │ message      │
│ end_date    │                │ rating (1-5)  │ │              ││          └──────────────┘
│ status      │                │ review_text   │ │              ││
│ total_price │                └───────────────┘ │              ││
└─────────────┘                                  │              ││
                                                 │              ││
                                                 │              ││
                              ┌──────────────────┘              ││
                              │                                 ││
                              ▼                                 ││
                     ┌──────────────────┐                       ││
                     │ REEL_COMMENTS    │                       ││
                     ├──────────────────┤                       ││
                     │ id (PK)          │                       ││
                     │ user_id (FK)─────┼───────────────────────┘│
                     │ reel_id (FK)─────┼────────────────────────┘
                     │ comment          │
                     └──────────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                  AUTHENTICATION & SESSION TABLES                      │
└──────────────────────────────────────────────────────────────────────┘

         ┌─────────────────┐
         │      USER       │
         └────────┬────────┘
                  │
                  │ 1:N
                  │
         ┌────────┴──────────┬─────────────────┬────────────────────┐
         │                   │                 │                    │
         ▼                   ▼                 ▼                    ▼
┌────────────────┐   ┌──────────────┐  ┌──────────────┐   ┌──────────────────┐
│    ACCOUNT     │   │   SESSION    │  │ VERIFICATION │   │  PASSWORD_RESET  │
├────────────────┤   ├──────────────┤  ├──────────────┤   │     _TOKENS      │
│ id (PK)        │   │ id (PK)      │  │ id (PK)      │   ├──────────────────┤
│ userId (FK)    │   │ userId (FK)  │  │ identifier   │   │ user_id (FK)     │
│ providerId     │   │ token        │  │ value        │   │ token            │
│ accountId      │   │ expiresAt    │  │ expiresAt    │   │ expires_at       │
│ accessToken    │   │ ipAddress    │  └──────────────┘   └──────────────────┘
└────────────────┘   └──────────────┘


┌──────────────────────────────────────────────────────────────────────┐
│                    MACHINERY AVAILABILITY TRACKING                    │
└──────────────────────────────────────────────────────────────────────┘

         ┌─────────────────┐
         │    MACHINERY    │
         └────────┬────────┘
                  │
                  │ 1:N
                  ▼
         ┌────────────────────────┐
         │ MACHINERY_UNAVAILABILITY│
         ├────────────────────────┤
         │ id (PK)                │
         │ machinery_id (FK)      │
         │ start_date             │
         │ end_date               │
         │ is_globally_unavailable│
         │ reason                 │
         └────────────────────────┘
```

---

## 🔄 Data Flow Diagrams

### 1. **User Registration & Authentication Flow**
```
┌─────────────┐
│   SIGNUP    │
└──────┬──────┘
       │
       ▼
┌──────────────────┐
│  Create "user"   │ ← Default role_id = 2 (buyer)
│  record          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Create "account" │ ← OAuth or password
│  record          │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Create "session" │ ← Session token
│  record          │
└──────────────────┘
```

### 2. **Machinery Rental Flow**
```
┌──────────────┐
│ Browse       │
│ Machinery    │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Check            │ ← Query machinery_unavailability
│ Availability     │   & reservations tables
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Create           │
│ RESERVATION      │ ← status: 'pending'
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Owner Approves   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Update status    │ ← 'confirmed' → 'completed'
│ to 'confirmed'   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ After rental,    │
│ Create REVIEW    │ ← rating (1-5) + review_text
└──────────────────┘
```

### 3. **Crop Waste Marketplace Flow**
```
┌─────────────────┐
│ Farmer lists    │
│ crop waste      │
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ Create CROP record  │ ← is_crop_waste = true
│ crop_type = 'waste' │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Buyers search       │ ← Filter: is_crop_waste = true
│ crop waste          │
└────────┬────────────┘
         │
         ▼
┌─────────────────────┐
│ Buyer sends MESSAGE │
│ to farmer           │
└─────────────────────┘
```

### 4. **Social Features Flow (Reels, Follows, Messages)**
```
┌────────────────┐
│ User creates   │
│ REEL           │
└───────┬────────┘
        │
        ▼
┌────────────────┐
│ Other users    │
│ view reel      │
└───────┬────────┘
        │
        ├─────────────┬──────────────┐
        │             │              │
        ▼             ▼              ▼
┌─────────────┐ ┌──────────┐ ┌─────────────┐
│ REEL_LIKES  │ │ REEL_    │ │  Follow     │
│             │ │ COMMENTS │ │  user       │
└─────────────┘ └──────────┘ └──────┬──────┘
                                    │
                                    ▼
                             ┌─────────────┐
                             │  FOLLOWS    │
                             │  record     │
                             └─────────────┘
```

---

## 📋 Table Relationships Summary

| Parent Table | Child Table | Relationship | Foreign Key | Cascade |
|-------------|-------------|--------------|-------------|---------|
| **roles** | user | 1:N | role_id | - |
| **user** | account | 1:N | userId | DELETE CASCADE |
| **user** | session | 1:N | userId | DELETE CASCADE |
| **user** | password_reset_tokens | 1:N | user_id | DELETE CASCADE |
| **user** | machinery | 1:N | owner_id | DELETE CASCADE |
| **user** | crops | 1:N | user_id | DELETE CASCADE |
| **user** | reels | 1:N | user_id | DELETE CASCADE |
| **user** | reservations | 1:N | user_id | DELETE CASCADE |
| **user** | favorites | 1:N | user_id | DELETE CASCADE |
| **user** | follows | 1:N (follower) | user_id | DELETE CASCADE |
| **user** | follows | 1:N (followed) | following_id | DELETE CASCADE |
| **user** | messages | 1:N (sender) | sender_id | DELETE CASCADE |
| **user** | messages | 1:N (receiver) | receiver_id | DELETE CASCADE |
| **user** | reviews | 1:N | user_id | DELETE CASCADE |
| **user** | reel_likes | 1:N | user_id | DELETE CASCADE |
| **user** | reel_comments | 1:N | user_id | DELETE CASCADE |
| **machinery** | reservations | 1:N | machinery_id | DELETE CASCADE |
| **machinery** | reviews | 1:N | machinery_id | DELETE CASCADE |
| **machinery** | favorites | 1:N | machinery_id | DELETE CASCADE |
| **machinery** | machinery_unavailability | 1:N | machinery_id | DELETE CASCADE |
| **reels** | reel_likes | 1:N | reel_id | DELETE CASCADE |
| **reels** | reel_comments | 1:N | reel_id | DELETE CASCADE |
| **reservations** | reviews | 1:1 | reservation_id | DELETE CASCADE |

---

## 🎯 Key Features & Their Tables

### 🚜 Machinery Rental System
- **machinery** - Equipment listings
- **machinery_unavailability** - Date blocking
- **reservations** - Booking records
- **reviews** - Post-rental feedback
- **favorites** - Saved machinery

### 🌾 Crop Management
- **crops** - Farmer crop listings
  - `crop_type`: 'grow' or 'waste'
  - `is_crop_waste`: Boolean flag
  - `expected_yield_date`, `expected_yield_quantity`

### 👥 Social Network
- **follows** - User connections
- **reels** - Video content
- **reel_likes** - Engagement
- **reel_comments** - User interaction

### 💬 Communication
- **messages** - Direct messaging
  - Can reference machinery_id for context

### 🔐 Authentication (Better Auth)
- **user** - Core user profile
- **account** - OAuth providers
- **session** - Active sessions
- **verification** - Email verification
- **password_reset_tokens** - Password recovery

### 🎭 Role-Based Access
- **roles** - Master role definitions
  - Farmer (id=1)
  - Buyer (id=2)
  - Admin (id=3)
- **user.role_id** - Foreign key to roles

---

## 🔍 Common Query Patterns

### Get all farmers with their stats
```sql
SELECT * FROM user_profile_stats WHERE role_name = 'farmer';
```

### Find available machinery near a location
```sql
SELECT * FROM machinery_with_details 
WHERE is_unavailable = FALSE 
  AND location ILIKE '%Bangalore%'
ORDER BY average_rating DESC;
```

### Get crop waste listings
```sql
SELECT c.*, u.name, u.phone 
FROM crops c 
JOIN "user" u ON c.user_id = u.id 
WHERE c.is_crop_waste = TRUE;
```

### Get user's reservations
```sql
SELECT * FROM reservations 
WHERE user_id = 'user_id_here' 
ORDER BY created_at DESC;
```

### Get conversation between two users
```sql
SELECT * FROM messages 
WHERE (sender_id = 'user1' AND receiver_id = 'user2') 
   OR (sender_id = 'user2' AND receiver_id = 'user1')
ORDER BY created_at ASC;
```

---

## 🎨 Database Views

### `machinery_with_details`
Combines machinery with owner info and ratings:
- owner_name, owner_phone, owner_image
- average_rating, review_count, total_bookings

### `user_profile_stats`
Complete user profile with aggregated stats:
- role_name, role_display_name, role_permissions
- machinery_count, crops_count
- followers_count, following_count
- total_reservations

---

## 📊 Indexing Strategy

### Performance Indexes
- **user**: email, role_id, location (lat/lng)
- **machinery**: owner_id, is_unavailable
- **reservations**: user_id, machinery_id, owner_id, status
- **messages**: sender_id, receiver_id, conversation pair
- **follows**: user_id, following_id
- **favorites**: user_id
- **reviews**: machinery_id, user_id
- **crops**: user_id, is_crop_waste
- **reels**: user_id, created_at (DESC)

---

## 🔒 Data Integrity

### Constraints
- **Unique**: email, roles.name, provider+accountId pairs
- **Check**: rating 1-5, status enum, role enum, crop_type enum
- **Foreign Keys**: All with ON DELETE CASCADE where appropriate
- **Not Null**: Critical fields like user.name, user.email, machinery.name

### Cascading Deletes
When a user is deleted:
- All their machinery listings → deleted
- All their reservations → deleted
- All their sessions → deleted
- All their follows → deleted
- All their messages → deleted
- All their reels → deleted

---

## 🚀 Setup Instructions

```bash
# 1. Install PostgreSQL
# Ubuntu: sudo apt-get install postgresql postgresql-contrib
# macOS: brew install postgresql
# Windows: Download from postgresql.org

# 2. Create database
createdb farmrent

# 3. Run schema
psql -d farmrent -f farmrent_complete_schema.sql

# 4. Verify
psql -d farmrent -c "\dt"

# 5. Test with views
psql -d farmrent -c "SELECT * FROM user_profile_stats;"

# 6. Update .env
DATABASE_URL=postgresql://username:password@localhost:5432/farmrent
```

---

**✅ Database is production-ready with:**
- Normalized structure with roles table
- Comprehensive indexing
- Foreign key constraints
- Cascading deletes
- Sample data for testing
- Useful views for complex queries
