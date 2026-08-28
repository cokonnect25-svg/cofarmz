import sql from '@/app/api/utils/sql';

export type SocialActivityType =
  | 'reel_like' | 'reel_comment' | 'reel_reply' | 'reel_mention'
  | 'post_like' | 'post_comment' | 'post_reply' | 'post_mention';

export async function ensureSocialActivityTables() {
  await sql`CREATE TABLE IF NOT EXISTS social_activity_notifications (
    id BIGSERIAL PRIMARY KEY,
    recipient_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    actor_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    reel_id BIGINT,
    post_id BIGINT,
    comment_id BIGINT,
    preview TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_social_activity_recipient_time ON social_activity_notifications(recipient_id, created_at DESC)`;
  await sql`ALTER TABLE reel_comments ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT REFERENCES reel_comments(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE profile_post_comments ADD COLUMN IF NOT EXISTS parent_comment_id BIGINT REFERENCES profile_post_comments(id) ON DELETE CASCADE`;
  await sql`CREATE TABLE IF NOT EXISTS reel_comment_likes (
    comment_id BIGINT NOT NULL REFERENCES reel_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(comment_id, user_id)
  )`;
  await sql`CREATE TABLE IF NOT EXISTS profile_post_comment_likes (
    comment_id BIGINT NOT NULL REFERENCES profile_post_comments(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(comment_id, user_id)
  )`;
}

export async function addSocialNotification(input: {
  recipientId?: string | null; actorId: string; type: SocialActivityType;
  reelId?: string | number; postId?: string | number; commentId?: string | number; preview?: string;
}) {
  if (!input.recipientId || input.recipientId === input.actorId) return;
  await sql`INSERT INTO social_activity_notifications
    (recipient_id, actor_id, type, reel_id, post_id, comment_id, preview)
    VALUES (${input.recipientId}, ${input.actorId}, ${input.type},
      ${input.reelId ? Number(input.reelId) : null}, ${input.postId ? Number(input.postId) : null},
      ${input.commentId ? Number(input.commentId) : null}, ${input.preview?.slice(0, 180) || null})`;
}

export async function notifyMentions(input: {
  text: string; actorId: string; type: 'reel_mention' | 'post_mention';
  reelId?: string | number; postId?: string | number; commentId: string | number; exclude?: string[];
}) {
  const names = Array.from(input.text.matchAll(/@([\p{L}\p{N}_.-]{2,40})/gu), match => match[1].toLowerCase());
  if (!names.length) return;
  const users = await sql`SELECT id FROM "user" WHERE LOWER(REPLACE(name, ' ', '')) = ANY(${names}) LIMIT 20`;
  const excluded = new Set([input.actorId, ...(input.exclude || [])]);
  await Promise.all(users.filter((u: any) => !excluded.has(String(u.id))).map((u: any) => addSocialNotification({
    recipientId: String(u.id), actorId: input.actorId, type: input.type,
    reelId: input.reelId, postId: input.postId, commentId: input.commentId, preview: input.text,
  })));
}
