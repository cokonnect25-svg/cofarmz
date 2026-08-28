"use client";

import { useState } from "react";
import { Heart, MessageCircle, Send, Share2, Trash2, X } from "lucide-react";
import { Share } from "@capacitor/share";
import { Capacitor } from "@capacitor/core";
import { useRouter } from "next/navigation";
import UserAvatar from "./UserAvatar";
import { getApiUrl } from "@/lib/api";
import { buildOpenUrl } from "@/lib/deep-link";

export type SocialPost = {
  id: number;
  user_id: string;
  content: string;
  image_url: string | null;
  audience: string;
  created_at: string;
  author_name?: string;
  author_image?: string | null;
  author_role?: string;
  likes?: number;
  comments?: number;
  is_liked?: boolean;
};
type Comment = {
  id: number;
  user_id: string;
  comment: string;
  created_at: string;
  name?: string;
  image?: string | null;
  parent_comment_id?: number | null;
  likes?: number;
  is_liked?: boolean;
};
type Liker = {
  id: string;
  name?: string;
  image?: string | null;
  role?: string;
  location?: string;
};

export default function PostCard({
  post,
  currentUserId,
  own,
  onDelete,
  compact = false,
}: {
  post: SocialPost;
  currentUserId?: string;
  own?: boolean;
  onDelete?: () => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(!!post.is_liked);
  const [likes, setLikes] = useState(Number(post.likes || 0));
  const [commentsCount, setCommentsCount] = useState(
    Number(post.comments || 0)
  );
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likers, setLikers] = useState<Liker[]>([]);

  const openProfile = (id: string) => {
    setExpanded(false);
    setLikersOpen(false);
    router.push(`/farmer-profile?id=${encodeURIComponent(id)}`);
  };
  const open = async () => {
    setExpanded(true);
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/comments`), {
      headers: currentUserId ? { "x-user-id": currentUserId } : {},
    });
    if (response.ok) setComments(await response.json());
  };
  const openLikers = async (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setLikersOpen(true);
    setLikersLoading(true);
    try {
      const response = await fetch(getApiUrl(`/api/posts/${post.id}/like`));
      if (response.ok) setLikers((await response.json()).likers || []);
    } finally {
      setLikersLoading(false);
    }
  };
  const toggleLike = async (event: React.MouseEvent) => {
    event.stopPropagation();
    if (!currentUserId) return;
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/like`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId }),
    });
    if (response.ok) {
      const data = await response.json();
      setLiked(data.liked);
      setLikes(data.likes);
    }
  };
  const comment = async () => {
    if (!currentUserId || !draft.trim() || sending) return;
    setSending(true);
    const response = await fetch(getApiUrl(`/api/posts/${post.id}/comments`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        comment: draft,
        parentCommentId: replyTo?.id || null,
      }),
    });
    if (response.ok) {
      const data = await response.json();
      setComments((v) => [...v, data]);
      setCommentsCount((v) => v + 1);
      setDraft("");
      setReplyTo(null);
    }
    setSending(false);
  };
  const beginReply = (item: Comment) => {
    setReplyTo(item);
    setDraft(`@${(item.name || "Member").replace(/\s+/g, "")} `);
  };
  const likeComment = async (item: Comment) => {
    if (!currentUserId) return;
    const response = await fetch(
      getApiUrl(`/api/posts/${post.id}/comments/${item.id}/like`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId }),
      }
    );
    if (response.ok) {
      const data = await response.json();
      setComments((values) =>
        values.map((value) =>
          value.id === item.id
            ? { ...value, likes: data.likes, is_liked: data.liked }
            : value
        )
      );
    }
  };
  const deleteComment = async (item: Comment) => {
    if (
      !currentUserId ||
      item.user_id !== currentUserId ||
      !confirm("Delete this comment?")
    )
      return;
    const response = await fetch(
      getApiUrl(`/api/posts/${post.id}/comments?commentId=${item.id}`),
      { method: "DELETE", headers: { "x-user-id": currentUserId } }
    );
    if (!response.ok) return;
    setComments((values) => {
      const removed = values.filter(
        (value) => value.id === item.id || value.parent_comment_id === item.id
      ).length;
      setCommentsCount((count) => Math.max(0, count - removed));
      return values.filter(
        (value) => value.id !== item.id && value.parent_comment_id !== item.id
      );
    });
    if (replyTo?.id === item.id) {
      setReplyTo(null);
      setDraft("");
    }
  };
  const richComment = (text: string) =>
    text.split(/(@[\p{L}\p{N}_.-]+)/gu).map((part, index) =>
      part.startsWith("@") ? (
        <span key={index} className="font-bold text-green-700">
          {part}
        </span>
      ) : (
        part
      )
    );
  const shareUrl = buildOpenUrl("/posts", { postId: post.id });
  const shareInside = () => {
    sessionStorage.setItem(
      "cofarmz_message_draft",
      `See this CoFarmz post from ${post.author_name || "a member"}:\n${
        post.content
      }\n${shareUrl}`
    );
    router.push("/messages");
  };
  const shareOutside = async () => {
    setShareOpen(false);
    const data = { title: "CoFarmz post", text: post.content, url: shareUrl };
    try {
      if (Capacitor.isNativePlatform()) await Share.share(data);
      else if (navigator.share) await navigator.share(data);
      else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Post link copied");
      }
    } catch {}
  };
  const Owner = ({ detail = false }: { detail?: boolean }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        openProfile(post.user_id);
      }}
      className="flex min-w-0 flex-1 items-center gap-3 text-left"
    >
      <UserAvatar
        image={post.author_image || ""}
        name={post.author_name || "User"}
        size={42}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-gray-900 hover:text-green-700">
          {post.author_name || "CoFarmz member"}
        </span>
        <span className="block truncate text-[10px] font-semibold capitalize text-gray-500">
          {post.author_role || "member"} ·{" "}
          {new Date(post.created_at).toLocaleString("en-IN")}
        </span>
        {detail && (
          <span className="block text-[10px] font-bold text-green-700">
            View profile
          </span>
        )}
      </span>
    </button>
  );

  return (
    <>
      <article
        onClick={open}
        className={`cursor-pointer overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm transition hover:shadow-md ${
          compact ? "w-[88%] max-w-md flex-none snap-center sm:w-[420px]" : ""
        }`}
      >
        <div className="flex items-center gap-3 p-4">
          <Owner />
          {own && onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="rounded-lg px-2 py-1 text-xs font-bold text-red-500 hover:bg-red-50"
            >
              Delete
            </button>
          )}
        </div>
        <p
          className={`${
            compact ? "line-clamp-5" : ""
          } whitespace-pre-wrap px-4 pb-4 text-sm leading-relaxed text-gray-700`}
        >
          {post.content}
        </p>
        {post.image_url && (
          <img
            src={post.image_url}
            alt={`Post by ${post.author_name || "member"}`}
            className={`${
              compact ? "h-56" : "max-h-[480px]"
            } w-full object-cover`}
          />
        )}
        {(likes > 0 || commentsCount > 0) && (
          <div className="flex justify-between border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            <button
              onClick={openLikers}
              className="font-semibold hover:text-green-700 hover:underline"
            >
              {likes} {likes === 1 ? "like" : "likes"}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                void open();
              }}
              className="hover:text-green-700 hover:underline"
            >
              {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
            </button>
          </div>
        )}
        <div
          className="grid grid-cols-3 border-t border-gray-100 p-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={toggleLike}
            className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold ${
              liked ? "text-red-600" : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Heart className="h-5 w-5" fill={liked ? "currentColor" : "none"} />
            {liked ? "Liked" : "Like"}
          </button>
          <button
            onClick={open}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <MessageCircle className="h-5 w-5" />
            Comment
          </button>
          <button
            onClick={() => setShareOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold text-gray-600 hover:bg-gray-50"
          >
            <Share2 className="h-5 w-5" />
            Share
          </button>
        </div>
      </article>

      {expanded && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
          onClick={() => setExpanded(false)}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-white px-4 py-3">
              <Owner detail />
              <button
                onClick={() => setExpanded(false)}
                aria-label="Close post details"
                className="rounded-full bg-gray-100 p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
                {post.content}
              </p>
              {post.image_url && (
                <img
                  src={post.image_url}
                  alt="Post detail"
                  className="mt-4 max-h-[55vh] w-full rounded-2xl bg-gray-50 object-contain"
                />
              )}
              <div className="mt-4 flex justify-between border-y border-gray-100 py-3 text-xs text-gray-500">
                <button
                  onClick={openLikers}
                  className="font-semibold hover:text-green-700 hover:underline"
                >
                  {likes} {likes === 1 ? "like" : "likes"}
                </button>
                <span>
                  {commentsCount} {commentsCount === 1 ? "comment" : "comments"}
                </span>
              </div>
              <h3 className="mb-3 mt-6 font-black">
                Comments ({commentsCount})
              </h3>
              <div className="space-y-4">
                {comments.length ? (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className={`flex gap-3 ${
                        c.parent_comment_id
                          ? "ml-10 border-l-2 border-green-100 pl-3"
                          : ""
                      }`}
                    >
                      <button
                        onClick={() => openProfile(c.user_id)}
                        className="self-start"
                      >
                        <UserAvatar
                          image={c.image || ""}
                          name={c.name || "Member"}
                          size={34}
                        />
                      </button>
                      <div className="min-w-0 rounded-2xl bg-gray-100 px-3 py-2">
                        <button
                          onClick={() => openProfile(c.user_id)}
                          className="text-xs font-black hover:text-green-700"
                        >
                          {c.name || "Member"}
                        </button>
                        <p className="break-words text-sm text-gray-700">
                          {richComment(c.comment)}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-[11px] font-bold text-gray-500">
                          <button
                            onClick={() => beginReply(c)}
                            className="hover:text-green-700"
                          >
                            Reply
                          </button>
                          <button
                            onClick={() => likeComment(c)}
                            className={
                              c.is_liked ? "text-red-600" : "hover:text-red-600"
                            }
                          >
                            {c.is_liked ? "Liked" : "Like"}
                            {c.likes ? ` (${c.likes})` : ""}
                          </button>
                          {c.user_id === currentUserId && (
                            <button
                              onClick={() => deleteComment(c)}
                              className="inline-flex items-center gap-1 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">
                    No comments yet. Be the first.
                  </p>
                )}
              </div>
              {currentUserId && (
                <>
                  {replyTo && (
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-green-50 px-3 py-2 text-xs text-green-800">
                      <span>
                        Replying to <b>{replyTo.name || "Member"}</b>
                      </span>
                      <button
                        onClick={() => {
                          setReplyTo(null);
                          setDraft("");
                        }}
                        aria-label="Cancel reply"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void comment();
                      }}
                      maxLength={1000}
                      placeholder="Write a comment…"
                      className="min-w-0 flex-1 rounded-xl border px-3 py-3 text-sm outline-none focus:border-green-500"
                    />
                    <button
                      onClick={comment}
                      disabled={!draft.trim() || sending}
                      className="rounded-xl bg-green-600 px-4 text-white disabled:opacity-50"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </section>
        </div>
      )}

      {likersOpen && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/60 sm:items-center sm:p-5"
          onClick={() => setLikersOpen(false)}
        >
          <section
            onClick={(e) => e.stopPropagation()}
            className="max-h-[70vh] w-full max-w-md overflow-hidden rounded-t-3xl bg-white shadow-xl sm:rounded-3xl"
          >
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h2 className="text-lg font-black">Liked by</h2>
              <button
                onClick={() => setLikersOpen(false)}
                aria-label="Close likes"
                className="rounded-full bg-gray-100 p-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {likersLoading ? (
                <div className="grid place-items-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-b-green-600" />
                </div>
              ) : likers.length ? (
                likers.map((liker) => (
                  <button
                    key={liker.id}
                    onClick={() => openProfile(liker.id)}
                    className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-green-50"
                  >
                    <UserAvatar
                      image={liker.image || ""}
                      name={liker.name || "Member"}
                      size={42}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-gray-900">
                        {liker.name || "CoFarmz member"}
                      </span>
                      <span className="block truncate text-xs capitalize text-gray-500">
                        {[liker.role, liker.location]
                          .filter(Boolean)
                          .join(" · ") || "Member"}
                      </span>
                    </span>
                    <span className="text-xs font-bold text-green-700">
                      View
                    </span>
                  </button>
                ))
              ) : (
                <p className="py-10 text-center text-sm text-gray-400">
                  No likes yet.
                </p>
              )}
            </div>
          </section>
        </div>
      )}

      {shareOpen && (
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-black/50 p-5"
          onClick={() => setShareOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-xl"
          >
            <h3 className="text-lg font-black">Share post</h3>
            <p className="mt-1 text-sm text-gray-500">
              Choose where you want to share it.
            </p>
            <button
              onClick={shareInside}
              className="mt-5 flex w-full items-center gap-3 rounded-2xl bg-green-50 p-4 text-left font-bold text-green-800"
            >
              <Send className="h-5 w-5" />
              Share inside CoFarmz
            </button>
            <button
              onClick={shareOutside}
              className="mt-2 flex w-full items-center gap-3 rounded-2xl bg-gray-100 p-4 text-left font-bold text-gray-800"
            >
              <Share2 className="h-5 w-5" />
              Share outside CoFarmz
            </button>
          </div>
        </div>
      )}
    </>
  );
}
