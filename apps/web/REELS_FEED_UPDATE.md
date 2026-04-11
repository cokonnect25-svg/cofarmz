# Reels Feed Update: Show All Reels with Following Prioritization

## Overview
Updated the reels feed to show **ALL reels** from all users, but with reels from farmers you follow appearing at the top of the feed.

## What Changed

### 1. **API Logic** (`/app/api/reels/route.ts`)
- **Before**: Only showed reels from followed farmers (JOIN with follows table)
- **After**: Shows ALL reels, but prioritizes followed creators
  - Fetches all reels from all users
  - Uses `is_followed` flag to check if creator is followed
  - Sorts by `is_followed DESC` then `created_at DESC`
  - This puts followed creators' reels at the top, then other reels below

**Key SQL Changes:**
```sql
-- New columns in the query
EXISTS(SELECT 1 FROM follows WHERE user_id = ${currentUserId} AND following_id = r.user_id) as is_followed

-- New ordering
ORDER BY 
  is_followed DESC,      -- Followed creators first
  r.created_at DESC      -- Then by newest first
```

### 2. **Frontend UI** (`/app/reels/page.tsx`)
- Added `is_followed` to Reel interface
- Added "Following" badge next to creator names
  - Semi-transparent white badge with border
  - Only visible for creators the user follows
  - Positioned inline with the creator's name

**Following Badge:**
```tsx
{reel.is_followed && (
  <span className="text-xs bg-white/20 backdrop-blur px-2 py-1 rounded-full border border-white/30">
    Following
  </span>
)}
```

### 3. **Empty State Message**
Updated the message when no reels exist:
- **Before**: "No reels from farmers you follow"
- **After**: "No reels yet" + hint to follow farmers

## How It Works

### Feed Ranking
1. **First**: Reels from followed farmers (sorted by newest)
2. **Second**: Reels from unfollowed farmers (sorted by newest)

### Visual Indicators
- ✅ "Following" badge appears next to creator name for followed creators
- No badge for unfollowed creators

### User Flow
1. User sees reels feed
2. Reels from followed farmers appear first
3. Scrolling down shows reels from other farmers
4. "Following" badge shows who they follow
5. Users can tap creator names to visit profiles

## Example Feed Order

If you follow Farmer A and Farmer C:
1. Farmer A's reel (newest) — has "Following" badge
2. Farmer A's older reel — has "Following" badge
3. Farmer C's reel — has "Following" badge
4. Farmer B's reel (unfollowed) — no badge
5. Farmer D's reel (unfollowed) — no badge
6. And so on...

## Database Query Performance
- Single query to fetch all reels with join to follows table
- Uses EXISTS subquery (efficient for checking follow status)
- Indexes on `follows` table recommended for large datasets

## Future Enhancements
- Add filter buttons to toggle "Following Only" / "All Reels"
- Show follower count for each creator
- Personalized ranking based on engagement
- Algorithm-based feed sorting
