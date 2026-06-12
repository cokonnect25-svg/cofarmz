"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell,
} from "recharts";

interface DailyGrowth { date: string; new_users: number; }
interface RoleCount { role: string; count: number; }
interface Stats { dailyGrowth: DailyGrowth[]; byRole: RoleCount[]; }
interface Announcement { id: string; title: string; body: string; created_at: string; expires_at?: string; }

function DailyGrowthChart({ data }: { data: DailyGrowth[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="text-center">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-gray-400 font-semibold text-sm">No growth data yet</p>
        </div>
      </div>
    );
  }
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#16a34a" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "none", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "12px", fontWeight: 700 }}
          formatter={(value: any) => [`${value} new users`, "Growth"]}
        />
        <Area type="monotone" dataKey="new_users" stroke="#16a34a" strokeWidth={2.5} fill="url(#growthGradient)" dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }} activeDot={{ r: 5, fill: "#16a34a" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const ROLE_COLORS: Record<string, string> = {
  farmer: "#16a34a", buyer: "#2563eb", supplier: "#9333ea", fpo: "#0d9488", superadmin: "#dc2626",
};

function RoleBreakdownChart({ data }: { data: RoleCount[] }) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="role" tickFormatter={(v) => v.toUpperCase()} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 700 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "none", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "12px", fontWeight: 700 }}
          formatter={(value: any, _name: any, props: any) => [`${props?.payload?.count ?? value} users`, props?.payload?.role ?? _name]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={index} fill={ROLE_COLORS[entry.role] || "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function AdminDashboard() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [verified, setVerified] = useState<"pending" | "ok" | "denied">("pending");

  // Announcement state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnn, setLoadingAnn] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annBody, setAnnBody] = useState("");
  const [annExpiry, setAnnExpiry] = useState("");
  const [posting, setPosting] = useState(false);
  const [annSuccess, setAnnSuccess] = useState("");

  useEffect(() => {
    if (loading) return;
    if (!user?.id) { router.replace("/login"); return; }
    fetch(getApiUrl(`/api/users/profile?userId=${user.id}`))
      .then((r) => r.json())
      .then((profile) => {
        if (profile.role === "superadmin" || profile.role_id === 5) {
          setVerified("ok");
        } else {
          setVerified("denied");
          router.replace("/home");
        }
      })
      .catch(() => { setVerified("denied"); router.replace("/home"); });
  }, [user?.id, loading]);

  useEffect(() => {
    if (verified !== "ok") return;
    fetch(getApiUrl(`/api/admin/stats`))
      .then((r) => r.json())
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
    fetchAnnouncements();
  }, [verified]);

  const fetchAnnouncements = () => {
    setLoadingAnn(true);
    fetch(getApiUrl(`/api/admin/announcements`))
      .then((r) => r.json())
      .then((data) => setAnnouncements(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingAnn(false));
  };

  const handlePostAnnouncement = async () => {
    if (!annTitle.trim() || !annBody.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(getApiUrl(`/api/admin/announcements`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: annTitle,
          body: annBody,
          createdBy: user?.name || "Admin",
          expiresAt: annExpiry || null,
        }),
      });
      if (res.ok) {
        setAnnTitle("");
        setAnnBody("");
        setAnnExpiry("");
        setAnnSuccess("Announcement posted! All users will see it in notifications.");
        setTimeout(() => setAnnSuccess(""), 4000);
        fetchAnnouncements();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setPosting(false);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    await fetch(getApiUrl(`/api/admin/announcements`), {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  if (loading || verified === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-400 font-semibold">Verifying access...</p>
        </div>
      </div>
    );
  }
  if (verified === "denied") return null;

  const totalUsers = stats?.byRole?.reduce((sum, r) => sum + r.count, 0) ?? 0;
  const todayGrowth = stats?.dailyGrowth?.at(-1)?.new_users ?? 0;
  const yesterdayGrowth = stats?.dailyGrowth?.at(-2)?.new_users ?? 0;
  const growthDelta = todayGrowth - yesterdayGrowth;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-xs font-black">CF</span>
          </div>
          <div>
            <h1 className="text-sm font-black text-gray-900">CoFarmz Admin</h1>
            <p className="text-[10px] text-gray-400 font-semibold">Super Admin Dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-bold text-gray-500 hidden sm:block">{user?.name}</span>
          <button onClick={signOut} className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── ANNOUNCEMENT COMPOSER ── */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-orange-50 rounded-xl flex items-center justify-center text-xl">📢</div>
            <div>
              <h2 className="text-lg font-black text-gray-900">Global Announcement</h2>
              <p className="text-xs text-gray-400 font-semibold">Posted announcements appear in all users' notifications</p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              placeholder="Announcement title..."
              value={annTitle}
              onChange={(e) => setAnnTitle(e.target.value)}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
            <textarea
              placeholder="Write your message to all users..."
              value={annBody}
              onChange={(e) => setAnnBody(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
            />
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">Expires at (optional)</label>
                <input
                  type="datetime-local"
                  value={annExpiry}
                  onChange={(e) => setAnnExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={handlePostAnnouncement}
                disabled={posting || !annTitle.trim() || !annBody.trim()}
                className="self-end px-6 py-2.5 bg-green-600 text-white text-sm font-black rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {posting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : "📤 Post"}
              </button>
            </div>
            {annSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-xs font-bold px-4 py-3 rounded-xl">
                ✅ {annSuccess}
              </div>
            )}
          </div>

          {/* Existing announcements */}
          {announcements.length > 0 && (
            <div className="mt-6 space-y-3">
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Active Announcements</p>
              {announcements.map((ann) => (
                <div key={ann.id} className="flex items-start justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900">{ann.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ann.body}</p>
                    <p className="text-[10px] text-gray-400 mt-1">
                      {new Date(ann.created_at).toLocaleString("en-IN")}
                      {ann.expires_at && ` · expires ${new Date(ann.expires_at).toLocaleDateString("en-IN")}`}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteAnnouncement(ann.id)}
                    className="text-red-400 hover:text-red-600 text-xs font-bold px-2 py-1 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: totalUsers, icon: "👥", color: "bg-blue-50 text-blue-700" },
            { label: "New Today", value: todayGrowth, icon: "🌱", color: "bg-green-50 text-green-700", delta: growthDelta },
            { label: "Farmers", value: stats?.byRole?.find((r) => r.role === "farmer")?.count ?? 0, icon: "🌾", color: "bg-amber-50 text-amber-700" },
            { label: "Buyers", value: stats?.byRole?.find((r) => r.role === "buyer")?.count ?? 0, icon: "🛒", color: "bg-purple-50 text-purple-700" },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-black uppercase tracking-wider ${card.color.split(" ")[1]}`}>{card.label}</span>
                <span className="text-xl">{card.icon}</span>
              </div>
              <p className="text-3xl font-black text-gray-900">{loadingStats ? "—" : card.value.toLocaleString()}</p>
              {"delta" in card && card.delta !== undefined && !loadingStats && (
                <p className={`text-[11px] font-bold mt-1 ${card.delta >= 0 ? "text-green-500" : "text-red-400"}`}>
                  {card.delta >= 0 ? "▲" : "▼"} {Math.abs(card.delta)} vs yesterday
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Daily Growth Chart */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-gray-900">Daily User Growth</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">New users joining per day — last 30 days</p>
          </div>
          {loadingStats ? <div className="h-64 bg-gray-50 rounded-xl animate-pulse" /> : <DailyGrowthChart data={stats?.dailyGrowth ?? []} />}
        </div>

        {/* Role Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-gray-900">Users by Role</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Breakdown across all platform roles</p>
          </div>
          {loadingStats ? <div className="h-48 bg-gray-50 rounded-xl animate-pulse" /> : (
            <>
              <RoleBreakdownChart data={stats?.byRole ?? []} />
              <div className="flex flex-wrap gap-2 mt-4">
                {(stats?.byRole ?? []).map((r) => (
                  <span key={r.role} className="text-[11px] font-black px-3 py-1 rounded-full"
                    style={{ background: (ROLE_COLORS[r.role] || "#6b7280") + "18", color: ROLE_COLORS[r.role] || "#6b7280" }}>
                    {r.role} · {r.count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

      </main>
    </div>
  );
}