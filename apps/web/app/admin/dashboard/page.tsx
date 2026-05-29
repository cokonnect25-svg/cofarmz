"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRouter } from "next/navigation";
import { getApiUrl } from "@/lib/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";

interface DailyGrowth {
  date: string;
  new_users: number;
}

interface RoleCount {
  role: string;
  count: number;
}

interface Stats {
  dailyGrowth: DailyGrowth[];
  byRole: RoleCount[];
}

function DailyGrowthChart({ data }: { data: DailyGrowth[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
        <div className="text-center">
          <p className="text-4xl mb-2">📊</p>
          <p className="text-gray-400 font-semibold text-sm">No growth data yet</p>
          <p className="text-gray-300 text-xs mt-1">Data will appear as users join</p>
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
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            fontSize: "12px",
            fontWeight: 700,
          }}
          formatter={(value: any) => [`${value} new users`, "Growth"]}
        />
        <Area
          type="monotone"
          dataKey="new_users"
          stroke="#16a34a"
          strokeWidth={2.5}
          fill="url(#growthGradient)"
          dot={{ r: 3, fill: "#16a34a", strokeWidth: 0 }}
          activeDot={{ r: 5, fill: "#16a34a" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

const ROLE_COLORS: Record<string, string> = {
  farmer: "#16a34a",
  buyer: "#2563eb",
  supplier: "#9333ea",
  fpo: "#0d9488",
  superadmin: "#dc2626",
};

function RoleBreakdownChart({ data }: { data: RoleCount[] }) {
  if (!data || data.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="role"
          tickFormatter={(value) => value.toUpperCase()}
          tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 700 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 10, fill: "#9ca3af", fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "#fff",
            border: "none",
            borderRadius: "12px",
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
            fontSize: "12px",
            fontWeight: 700,
          }}
          formatter={(value: any, _name: any, props: any) => [
            `${props?.payload?.count ?? value} users`,
            props?.payload?.role ?? _name,
          ]}
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
  // ── Key fix: verify role from DB, not session ──
  const [verified, setVerified] = useState<"pending" | "ok" | "denied">("pending");

  useEffect(() => {
    // Wait until auth is ready
    if (loading) return;

    // Not logged in at all
    if (!user?.id) {
      router.replace("/login");
      return;
    }

    // Fetch profile from DB to check actual role
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
      .catch(() => {
        setVerified("denied");
        router.replace("/home");
      });
  }, [user?.id, loading]);

  // Fetch stats only after verified
  useEffect(() => {
    if (verified !== "ok") return;
    fetch(getApiUrl(`/api/admin/stats`))
      .then((r) => r.json())
      .then((data) => setStats(data))
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [verified]);

  // Show spinner while auth loads OR while verifying role
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

  // Denied — show nothing (redirect is happening)
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
          <button
            onClick={signOut}
            className="text-xs font-bold text-red-500 bg-red-50 px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users", value: totalUsers, icon: "👥", color: "bg-blue-50 text-blue-700" },
            {
              label: "New Today",
              value: todayGrowth,
              icon: "🌱",
              color: "bg-green-50 text-green-700",
              delta: growthDelta,
            },
            {
              label: "Farmers",
              value: stats?.byRole?.find((r) => r.role === "farmer")?.count ?? 0,
              icon: "🌾",
              color: "bg-amber-50 text-amber-700",
            },
            {
              label: "Buyers",
              value: stats?.byRole?.find((r) => r.role === "buyer")?.count ?? 0,
              icon: "🛒",
              color: "bg-purple-50 text-purple-700",
            },
          ].map((card) => (
            <div key={card.label} className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs font-black uppercase tracking-wider ${card.color.split(" ")[1]}`}>
                  {card.label}
                </span>
                <span className="text-xl">{card.icon}</span>
              </div>
              <p className="text-3xl font-black text-gray-900">
                {loadingStats ? "—" : card.value.toLocaleString()}
              </p>
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
          {loadingStats ? (
            <div className="h-64 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <DailyGrowthChart data={stats?.dailyGrowth ?? []} />
          )}
        </div>

        {/* Role Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-black text-gray-900">Users by Role</h2>
            <p className="text-xs text-gray-400 font-semibold mt-0.5">Breakdown across all platform roles</p>
          </div>
          {loadingStats ? (
            <div className="h-48 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <>
              <RoleBreakdownChart data={stats?.byRole ?? []} />
              <div className="flex flex-wrap gap-2 mt-4">
                {(stats?.byRole ?? []).map((r) => (
                  <span
                    key={r.role}
                    className="text-[11px] font-black px-3 py-1 rounded-full"
                    style={{
                      background: (ROLE_COLORS[r.role] || "#6b7280") + "18",
                      color: ROLE_COLORS[r.role] || "#6b7280",
                    }}
                  >
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