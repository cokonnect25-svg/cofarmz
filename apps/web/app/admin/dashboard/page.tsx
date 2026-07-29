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
interface RoleCount { role: string; count: number; }interface ActivitySummary {
  logins: number;
  page_views: number;
  reservations: number;
  machinery_views: number;
  profile_views: number;
  nearby_views: number;
  call_contacts: number;
  message_contacts: number;
  contacts: number;
}
interface DailyActivity { date: string; logins: number; page_views: number; reservations: number; contacts: number; }
interface TopPage { page_path: string; views: number; }
interface RecentLogin { user_name: string; user_email: string; created_at: string; method?: string; }
interface RecentReservation {
  id: number;
  renter_name: string;
  owner_name: string;
  machinery_name: string;
  status: string;
  total_price: number;
  created_at: string;
}
interface TopEntity { machinery_id?: string; machinery_name?: string; profile_id?: string; profile_name?: string; profile_email?: string; views: number; }
interface ProfileViewDetail {
  id: number;
  viewer_id?: string;
  viewer_name: string;
  viewer_email: string;
  profile_id?: string;
  profile_name: string;
  profile_email: string;
  page_path?: string;
  created_at: string;
}
interface NearbyView { type: string; views: number; }
interface BookingStatus { status: string; count: number; }
interface EquipmentBookingReport {
  machinery_id?: string;
  machinery_name: string;
  owner_id?: string;
  owner_name: string;
  bookings: number;
  pending: number;
  accepted: number;
  completed: number;
  lost: number;
  revenue_requested: number;
  last_booked_at: string;
}
interface ContactReport {
  id: number;
  contact_type: "call" | "message";
  sender_id?: string;
  sender_name: string;
  sender_email: string;
  receiver_id?: string;
  receiver_name: string;
  receiver_email: string;
  machinery_id?: string;
  machinery_name?: string;
  message_type?: string;
  created_at: string;
}
interface RecentEvent {
  event_type: string;
  user_name: string;
  user_email: string;
  page_path?: string;
  entity_id?: string;
  entity_name?: string;
  created_at: string;
}
interface Stats {
  dailyGrowth: DailyGrowth[];
  byRole: RoleCount[];
  activitySummary: ActivitySummary;
  dailyActivity: DailyActivity[];
  topPages: TopPage[];
  recentLogins: RecentLogin[];
  recentReservations: RecentReservation[];
  bookingStatusBreakdown: BookingStatus[];
  equipmentBookingReport: EquipmentBookingReport[];
  topMachineryViews: TopEntity[];
  profileViews: TopEntity[];
  profileViewDetails: ProfileViewDetail[];
  nearbyViews: NearbyView[];
  recentMessageContacts: ContactReport[];
  recentCallContacts: ContactReport[];
  recentEvents: RecentEvent[];
}
interface Announcement {
  id: string; title: string; body: string; created_at: string; expires_at?: string;
  scheduled_at?: string; repeat_interval_hours?: number; next_send_at?: string;
  last_sent_at?: string; send_count?: number; is_active?: boolean;
}

function normalizeRole(role?: string) {
  const value = (role || "unknown").trim().toLowerCase();
  if (["farmer", "farmers"].includes(value)) return "farmer";
  if (["buyer", "buyers"].includes(value)) return "buyer";
  if (["supplier", "suppliers"].includes(value)) return "supplier";
  if (["fpo", "fpos"].includes(value)) return "fpo";
  if (["superadmin", "super_admin", "admin"].includes(value)) return "superadmin";
  return value;
}

function roleLabel(role?: string) {
  const normalized = normalizeRole(role);
  const labels: Record<string, string> = {
    farmer: "Farmer",
    buyer: "Buyer",
    supplier: "Supplier",
    fpo: "FPO",
    superadmin: "Super Admin",
  };
  return labels[normalized] || normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
  const chartData = data.map((entry) => ({
    ...entry,
    role: normalizeRole(entry.role),
    role_label: roleLabel(entry.role),
  }));
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="role_label" tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 700 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "#fff", border: "none", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "12px", fontWeight: 700 }}
          formatter={(value: any, _name: any, props: any) => [`${props?.payload?.count ?? value} users`, props?.payload?.role_label ?? _name]}
        />
        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={index} fill={ROLE_COLORS[entry.role] || "#6b7280"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ActivityTrendChart({ data }: { data: DailyActivity[] }) {
  if (!data || data.length === 0) {
    return <div className="h-64 bg-gray-50 rounded-xl border border-dashed border-gray-200 flex items-center justify-center text-sm font-bold text-gray-400">No traction events yet</div>;
  }
  const formatted = data.map((d) => ({
    ...d,
    label: new Date(d.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
  }));
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={formatted} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ background: "#fff", border: "none", borderRadius: "12px", boxShadow: "0 8px 30px rgba(0,0,0,0.12)", fontSize: "12px", fontWeight: 700 }} />
        <Area type="monotone" dataKey="contacts" name="Contacts" stroke="#2563eb" fill="#2563eb22" strokeWidth={2} />
        <Area type="monotone" dataKey="logins" name="Logins" stroke="#16a34a" fill="#16a34a22" strokeWidth={2} />
        <Area type="monotone" dataKey="reservations" name="Bookings" stroke="#f59e0b" fill="#f59e0b22" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function eventLabel(type: string) {
  return type.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const PAGE_LABELS: Record<string, string> = {
  "/": "Home",
  "/nearby-farmers": "Nearby Farmers",
  "/machinery-details": "Machinery Details",
  "/machinery-list": "Machinery List",
  "/farmer-profile": "Farmer Profile",
  "/user-profile": "User Profile",
  "/my-reservations": "My Reservations",
  "/booking-requests": "Booking Requests",
  "/rent-machinery": "Rent Machinery",
  "/top-picks": "Top Picks",
  "/messages": "Messages",
  "/notifications": "Notifications",
  "/reels": "Reels",
  "/login": "Login",
  "/signup": "Signup",
};

function pageLabel(pagePath?: string): string {
  if (!pagePath) return "Unknown Page";
  const [path, query = ""] = pagePath.split("?");
  const label = PAGE_LABELS[path] || path.replace(/^\/+/, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Home";
  const params = new URLSearchParams(query);
  const type = params.get("type");
  const source = params.get("source");

  if (path === "/nearby-farmers" && type === "buyers") return "Nearby Buyers";
  if (path === "/nearby-farmers") return "Nearby Farmers";
  if (path === "/machinery-details" && source) return `${label} from ${pageLabel(`/${source}`)}`;

  return label;
}


function profileLink(profileId?: string) {
  return profileId ? `/farmer-profile?id=${encodeURIComponent(profileId)}` : "/farmer-profile";
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
  const [annDelivery, setAnnDelivery] = useState<"now" | "scheduled">("now");
  const [annScheduledAt, setAnnScheduledAt] = useState("");
  const [annRepeatHours, setAnnRepeatHours] = useState("");
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
          createdBy: user?.id,
          expiresAt: annExpiry ? new Date(annExpiry).toISOString() : null,
          scheduledAt: annDelivery === "scheduled" && annScheduledAt ? new Date(annScheduledAt).toISOString() : null,
          repeatIntervalHours: annRepeatHours ? Number(annRepeatHours) : null,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setAnnTitle("");
        setAnnBody("");
        setAnnExpiry("");
        setAnnScheduledAt("");
        setAnnRepeatHours("");
        setAnnDelivery("now");
        setAnnSuccess(created.sentImmediately ? "Announcement pushed to all users." : "Announcement scheduled successfully.");
        setTimeout(() => setAnnSuccess(""), 4000);
        fetchAnnouncements();
      } else {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || "Failed to save announcement");
      }
    } catch (e) {
      console.error(e);
      setAnnSuccess(e instanceof Error ? e.message : "Failed to save announcement");
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
  const activity = stats?.activitySummary ?? {
    logins: 0,
    page_views: 0,
    reservations: 0,
    machinery_views: 0,
    profile_views: 0,
    nearby_views: 0,
    call_contacts: 0,
    message_contacts: 0,
    contacts: 0,
  };
  const byRole = (stats?.byRole ?? []).map((r) => ({
    ...r,
    role: normalizeRole(r.role),
  }));
  const roleCount = (role: string) => byRole.find((r) => r.role === role)?.count ?? 0;
  const contactReports = [
    ...(stats?.recentCallContacts ?? []),
    ...(stats?.recentMessageContacts ?? []),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 20);
  const contactToBookingRate = activity.contacts > 0 ? Math.round((activity.reservations / activity.contacts) * 100) : 0;
  const viewToContactRate = activity.machinery_views > 0 ? Math.round((activity.contacts / activity.machinery_views) * 100) : 0;

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

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">Delivery</label>
                <select value={annDelivery} onChange={(e) => setAnnDelivery(e.target.value as "now" | "scheduled")} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="now">Push now</option>
                  <option value="scheduled">Schedule for later</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">Repeat frequency</label>
                <select value={annRepeatHours} onChange={(e) => setAnnRepeatHours(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500">
                  <option value="">Send once</option>
                  <option value="1">Every 1 hour</option>
                  <option value="3">Every 3 hours</option>
                  <option value="6">Every 6 hours</option>
                  <option value="12">Every 12 hours</option>
                </select>
              </div>
              {annDelivery === "scheduled" && (
                <div>
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">First push at</label>
                  <input
                    type="datetime-local"
                    value={annScheduledAt}
                    min={new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)}
                    onChange={(e) => setAnnScheduledAt(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 block">
                  Stop sending / expires at {annRepeatHours ? "(recommended)" : "(optional)"}
                </label>
                <input
                  type="datetime-local"
                  value={annExpiry}
                  onChange={(e) => setAnnExpiry(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <button
                onClick={handlePostAnnouncement}
                disabled={posting || !annTitle.trim() || !annBody.trim() || (annDelivery === "scheduled" && !annScheduledAt)}
                className="self-end px-6 py-2.5 bg-green-600 text-white text-sm font-black rounded-xl hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {posting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : annDelivery === "scheduled" ? "Schedule" : "Push Now"}
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
              <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">Announcements and schedules</p>
              {announcements.map((ann) => (
                <div key={ann.id} className="flex items-start justify-between gap-3 bg-orange-50 border border-orange-100 rounded-xl p-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-900">{ann.title}</p>
                    <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{ann.body}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {ann.scheduled_at && !ann.last_sent_at && <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Scheduled {new Date(ann.scheduled_at).toLocaleString("en-IN")}</span>}
                      {ann.repeat_interval_hours && <span className="text-[10px] font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-full">Every {ann.repeat_interval_hours}h</span>}
                      {!!ann.send_count && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-1 rounded-full">Sent {ann.send_count} time{ann.send_count === 1 ? "" : "s"}</span>}
                      {ann.next_send_at && ann.is_active && <span className="text-[10px] font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded-full">Next {new Date(ann.next_send_at).toLocaleString("en-IN")}</span>}
                    </div>
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
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
          {[
            { label: "Total Users", value: totalUsers, icon: "👥", color: "bg-blue-50 text-blue-700" },
            { label: "New Today", value: todayGrowth, icon: "🌱", color: "bg-green-50 text-green-700", delta: growthDelta },
            { label: "Logins", value: activity.logins, icon: "IN", color: "bg-emerald-50 text-emerald-700" },
            { label: "Contacts", value: activity.contacts, icon: "CT", color: "bg-sky-50 text-sky-700" },
            { label: "Calls", value: activity.call_contacts, icon: "CL", color: "bg-lime-50 text-lime-700" },
            { label: "Messages", value: activity.message_contacts, icon: "MS", color: "bg-cyan-50 text-cyan-700" },
            { label: "Bookings", value: activity.reservations, icon: "BK", color: "bg-orange-50 text-orange-700" },
            { label: "Machine Views", value: activity.machinery_views, icon: "MV", color: "bg-indigo-50 text-indigo-700" },
            { label: "Profile Views", value: activity.profile_views, icon: "PR", color: "bg-rose-50 text-rose-700" },
            { label: "Farmers", value: roleCount("farmer"), icon: "🌾", color: "bg-amber-50 text-amber-700" },
            { label: "Buyers", value: roleCount("buyer"), icon: "🛒", color: "bg-purple-50 text-purple-700" },
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

        {/* Traction Overview */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-black text-gray-900">Application Traction</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Logins, contacts, and equipment bookings over the last 14 days</p>
            </div>
            {loadingStats ? <div className="h-64 bg-gray-50 rounded-xl animate-pulse" /> : <ActivityTrendChart data={stats?.dailyActivity ?? []} />}
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-black text-gray-900">Contact Conversion</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Calls, messages, and booking movement in the last 30 days</p>
            </div>
            <div className="space-y-4">
              {loadingStats ? (
                <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-lime-50 p-4">
                      <p className="text-[10px] font-black uppercase text-lime-700">Calls</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{activity.call_contacts.toLocaleString()}</p>
                    </div>
                    <div className="rounded-xl bg-cyan-50 p-4">
                      <p className="text-[10px] font-black uppercase text-cyan-700">Messages</p>
                      <p className="text-3xl font-black text-gray-900 mt-1">{activity.message_contacts.toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="rounded-xl bg-orange-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-orange-700">Contacts to bookings</p>
                      <p className="text-lg font-black text-gray-900">{contactToBookingRate}%</p>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-orange-500" style={{ width: `${Math.min(100, contactToBookingRate)}%` }} />
                    </div>
                  </div>
                  <div className="rounded-xl bg-indigo-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-black text-indigo-700">Equipment views to contacts</p>
                      <p className="text-lg font-black text-gray-900">{viewToContactRate}%</p>
                    </div>
                    <div className="h-2 bg-white rounded-full overflow-hidden mt-2">
                      <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, viewToContactRate)}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-black text-gray-900">Who Logged In</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Latest successful sign-ins captured by the app</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {(stats?.recentLogins ?? []).length === 0 ? (
                <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No login events yet</p>
              ) : (
                (stats?.recentLogins ?? []).map((login, index) => (
                  <div key={`${login.user_email}-${login.created_at}-${index}`} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-gray-900 truncate">{login.user_name}</p>
                      <p className="text-xs text-gray-500 truncate">{login.user_email || "No email"} {login.method ? `• ${login.method}` : ""}</p>
                    </div>
                    <span className="text-[11px] font-bold text-gray-400 flex-shrink-0">{formatDateTime(login.created_at)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-black text-gray-900">Equipment Reservations</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Latest machinery booking requests and status</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {(stats?.recentReservations ?? []).length === 0 ? (
                <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No reservations yet</p>
              ) : (
                (stats?.recentReservations ?? []).map((reservation) => (
                  <div key={reservation.id} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{reservation.machinery_name}</p>
                        <p className="text-xs text-gray-500 truncate">{reservation.renter_name || "User"} booked from {reservation.owner_name || "Owner"}</p>
                      </div>
                      <span className="text-[10px] font-black uppercase px-2 py-1 rounded-full bg-orange-50 text-orange-700">{reservation.status}</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-black text-green-700">₹{Number(reservation.total_price || 0).toLocaleString("en-IN")}</span>
                      <span className="text-[11px] font-bold text-gray-400">{formatDateTime(reservation.created_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-gray-900">Who Contacted Whom</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Recent calls and messages between users, including equipment context where available</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full">Last 30 days</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {contactReports.length === 0 ? (
              <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No call or message contacts yet</p>
            ) : (
              contactReports.map((contact) => (
                <div key={`${contact.contact_type}-${contact.id}`} className="grid md:grid-cols-[110px_1fr_1fr_150px] gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full w-fit h-fit ${contact.contact_type === "call" ? "bg-lime-50 text-lime-700" : "bg-cyan-50 text-cyan-700"}`}>
                    {contact.contact_type}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">From</p>
                    <p className="text-sm font-black text-gray-900 truncate">{contact.sender_name}</p>
                    <p className="text-xs text-gray-500 truncate">{contact.sender_email || contact.sender_id || "No email"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">To</p>
                    <p className="text-sm font-black text-gray-900 truncate">{contact.receiver_name}</p>
                    <p className="text-xs text-gray-500 truncate">{contact.machinery_name || contact.receiver_email || contact.receiver_id || "No equipment context"}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] font-bold text-gray-400">{formatDateTime(contact.created_at)}</p>
                    <p className="text-[11px] font-black text-gray-600 mt-1">{contact.message_type || "contact"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className="mb-5">
              <h2 className="text-lg font-black text-gray-900">Booked Equipment Report</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Equipment that received booking requests, with owner and status movement</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-gray-100">
              {(stats?.equipmentBookingReport ?? []).length === 0 ? (
                <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No equipment bookings yet</p>
              ) : (
                (stats?.equipmentBookingReport ?? []).map((item) => (
                  <div key={item.machinery_id || item.machinery_name} className="px-4 py-3 border-b border-gray-100 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-black text-gray-900 truncate">{item.machinery_name}</p>
                        <p className="text-xs text-gray-500 truncate">Owner: {item.owner_name}</p>
                      </div>
                      <span className="text-xs font-black text-orange-700 bg-orange-50 px-2 py-1 rounded-full">{item.bookings} bookings</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mt-3">
                      <span className="text-[10px] font-black text-amber-700 bg-amber-50 rounded-lg px-2 py-1 text-center">{item.pending} pending</span>
                      <span className="text-[10px] font-black text-green-700 bg-green-50 rounded-lg px-2 py-1 text-center">{item.accepted} accepted</span>
                      <span className="text-[10px] font-black text-blue-700 bg-blue-50 rounded-lg px-2 py-1 text-center">{item.completed} done</span>
                      <span className="text-[10px] font-black text-red-700 bg-red-50 rounded-lg px-2 py-1 text-center">{item.lost} lost</span>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs font-black text-green-700">₹{Number(item.revenue_requested || 0).toLocaleString("en-IN")}</span>
                      <span className="text-[11px] font-bold text-gray-400">Last: {formatDateTime(item.last_booked_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-1">Booking Status</h2>
            <p className="text-xs text-gray-400 font-semibold mb-5">Current booking request health</p>
            <div className="space-y-3">
              {(stats?.bookingStatusBreakdown ?? []).length === 0 ? <p className="text-sm font-bold text-gray-400">No bookings yet</p> : (stats?.bookingStatusBreakdown ?? []).map((item) => (
                <div key={item.status} className="flex items-center justify-between gap-3 bg-orange-50/60 rounded-xl p-3">
                  <span className="text-sm font-black text-gray-800 capitalize">{item.status}</span>
                  <span className="text-xs font-black text-orange-700">{item.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-1">Machinery Viewed</h2>
            <p className="text-xs text-gray-400 font-semibold mb-5">Equipment getting attention</p>
            <div className="space-y-3">
              {(stats?.topMachineryViews ?? []).length === 0 ? <p className="text-sm font-bold text-gray-400">No machinery views yet</p> : (stats?.topMachineryViews ?? []).map((item) => (
                <div key={item.machinery_id || item.machinery_name} className="flex items-center justify-between gap-3 bg-indigo-50/60 rounded-xl p-3">
                  <span className="text-sm font-black text-gray-800 truncate">{item.machinery_name}</span>
                  <span className="text-xs font-black text-indigo-700">{item.views} views</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-1">Profiles Viewed</h2>
            <p className="text-xs text-gray-400 font-semibold mb-5">People whose profiles got attention</p>
            <div className="space-y-3">
              {(stats?.profileViews ?? []).length === 0 ? <p className="text-sm font-bold text-gray-400">No profile views yet</p> : (stats?.profileViews ?? []).map((item) => (
                <button
                  key={item.profile_id || item.profile_name}
                  onClick={() => router.push(profileLink(item.profile_id))}
                  className="w-full flex items-center justify-between gap-3 bg-emerald-50/60 hover:bg-emerald-100 rounded-xl p-3 text-left transition-colors"
                >
                  <div className="min-w-0">
                    <span className="block text-sm font-black text-gray-800 truncate">{item.profile_name}</span>
                    <span className="block text-[10px] font-semibold text-gray-500 truncate">{item.profile_email || item.profile_id || "No email"}</span>
                  </div>
                  <span className="text-xs font-black text-emerald-700 flex-shrink-0">{item.views} views</span>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h2 className="text-lg font-black text-gray-900 mb-1">Nearby Usage</h2>
            <p className="text-xs text-gray-400 font-semibold mb-5">Nearby farmer/buyer discovery</p>
            <div className="space-y-3">
              {(stats?.nearbyViews ?? []).length === 0 ? <p className="text-sm font-bold text-gray-400">No nearby views yet</p> : (stats?.nearbyViews ?? []).map((item) => (
                <div key={item.type} className="flex items-center justify-between gap-3 bg-sky-50/60 rounded-xl p-3">
                  <span className="text-sm font-black text-gray-800">{item.type === "buyers" ? "Nearby Buyers" : "Nearby Farmers"}</span>
                  <span className="text-xs font-black text-sky-700">{item.views} views</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <div>
              <h2 className="text-lg font-black text-gray-900">Who Viewed Profiles</h2>
              <p className="text-xs text-gray-400 font-semibold mt-0.5">Viewer name, email, viewed person, and direct profile link</p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full">Last 30 days</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {(stats?.profileViewDetails ?? []).length === 0 ? (
              <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No profile viewer details yet</p>
            ) : (
              (stats?.profileViewDetails ?? []).map((view) => (
                <button
                  key={view.id}
                  onClick={() => router.push(profileLink(view.profile_id))}
                  className="w-full grid md:grid-cols-[1fr_1fr_150px] gap-3 px-4 py-3 border-b border-gray-100 last:border-b-0 text-left hover:bg-emerald-50/60 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-400">Viewer</p>
                    <p className="text-sm font-black text-gray-900 truncate">{view.viewer_name}</p>
                    <p className="text-xs font-semibold text-gray-500 truncate">{view.viewer_email || "No email"}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-wider text-emerald-600">Viewed Profile</p>
                    <p className="text-sm font-black text-gray-900 truncate">{view.profile_name}</p>
                    <p className="text-xs font-semibold text-gray-500 truncate">{view.profile_email || view.profile_id || pageLabel(view.page_path)}</p>
                  </div>
                  <div className="md:text-right">
                    <p className="text-[11px] font-bold text-gray-400">{formatDateTime(view.created_at)}</p>
                    <p className="text-[11px] font-black text-emerald-700 mt-1">Open profile</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-5">
            <h2 className="text-lg font-black text-gray-900">Live Activity Feed</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Recent activity across logins, pages, profiles, machinery, and bookings</p>
          </div>
          <div className="overflow-hidden rounded-xl border border-gray-100">
            {(stats?.recentEvents ?? []).length === 0 ? (
              <p className="text-sm font-bold text-gray-400 bg-gray-50 p-4 text-center">No activity captured yet</p>
            ) : (
              (stats?.recentEvents ?? []).map((event, index) => (
                <div key={`${event.event_type}-${event.created_at}-${index}`} className="grid md:grid-cols-[170px_1fr_160px] gap-2 px-4 py-3 border-b border-gray-100 last:border-b-0">
                  <span className="text-xs font-black text-gray-700">{eventLabel(event.event_type)}</span>
                  <span className="text-xs text-gray-500 truncate">
                    <b className="text-gray-800">{event.user_name}</b>
                    {event.entity_name ? ` interacted with ${event.entity_name}` : event.page_path ? ` viewed ${pageLabel(event.page_path)}` : ""}
                  </span>
                  <span className="text-[11px] font-bold text-gray-400 md:text-right">{formatDateTime(event.created_at)}</span>
                </div>
              ))
            )}
          </div>
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
              <RoleBreakdownChart data={byRole} />
              <div className="flex flex-wrap gap-2 mt-4">
                {byRole.map((r) => (
                  <span key={r.role} className="text-[11px] font-black px-3 py-1 rounded-full"
                    style={{ background: (ROLE_COLORS[r.role] || "#6b7280") + "18", color: ROLE_COLORS[r.role] || "#6b7280" }}>
                    {roleLabel(r.role)} · {r.count}
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
