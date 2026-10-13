import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { useAuth } from "../../context/useAuth";
import { useContext } from "react";
import { SocketContext } from "../../socket/SocketContext";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden animate-pulse">
      <div className="h-20 bg-slate-200" />
      <div className="p-5">
        <div className="h-3 bg-slate-200 rounded w-24 mb-3" />
        <div className="h-8 bg-slate-200 rounded w-12" />
        <div className="h-3 bg-slate-100 rounded w-20 mt-3" />
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ card, onClick }) {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={`
        group relative bg-white rounded-2xl shadow border border-slate-100
        overflow-hidden cursor-pointer
        transition-all duration-300 ease-out
        hover:scale-[1.03] hover:shadow-xl hover:border-slate-200
        focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-400
      `}
    >
      {/* Gradient banner */}
      <div className={`bg-gradient-to-br ${card.bg} p-5 text-white flex items-center justify-between`}>
        <div className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">{card.icon}</div>
        <span className="text-3xl font-extrabold tracking-tight">{card.value}</span>
      </div>

      {/* Body */}
      <div className="p-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{card.label}</p>
          {card.subtext && (
            <p className="text-xs text-slate-400 mt-0.5">{card.subtext}</p>
          )}
        </div>
        <span className="flex items-center gap-1 text-xs font-semibold text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          View Details
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1 duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
function Dashboard() {
  const { user } = useAuth();
  const socket = useContext(SocketContext);
  const navigate = useNavigate();

  const [stats, setStats] = useState({ totalEmployees: 0, todayAttendance: 0, lateEmployees: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const fetchData = async () => {
    setStatsLoading(true);
    try {
      const statsRes = await api.get("/admin/dashboard-stats");
      setStats(statsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();

    if (!socket) return;

    const handleUpdate = () => fetchData();

    const handleNotification = (notif) => {
      showNotification(notif.message);
      fetchData();
    };

    socket.on("dashboard-update", handleUpdate);
    socket.on("new-notification", handleNotification);

    return () => {
      socket.off("dashboard-update", handleUpdate);
      socket.off("new-notification", handleNotification);
    };
  }, [socket]);

  const statCards = [
    {
      label: "Total Staff",
      value: stats.totalEmployees,
      subtext: "All active employees",
      onClick: () => navigate("/admin/employees"),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      bg: "from-primary-500 to-primary-700",
    },
    {
      label: "Present Today",
      value: stats.todayAttendance,
      subtext: "Clocked in today",
      onClick: () => navigate("/admin/attendance?filter=present"),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: "from-emerald-500 to-emerald-700",
    },
    {
      label: "Late Arrivals",
      value: stats.lateEmployees,
      subtext: "Past 9:15 AM",
      onClick: () => navigate("/admin/attendance?filter=late"),
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bg: "from-rose-500 to-rose-700",
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Toast */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${notification.type === "error" ? "bg-rose-600" : "bg-emerald-600"}`}>
          {notification.type === "error" ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          )}
          {notification.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            Welcome, {user?.name || "Admin"}! <span className="text-2xl">👋</span>
          </h2>
          <p className="mt-2 text-slate-500 font-medium">
             Here's what's happening with Vision Thoughts today.
          </p>
        </div>
        <div className="hidden md:block">
          <span className="px-5 py-2.5 bg-primary-50 text-primary-700 rounded-2xl font-bold text-xs border border-primary-100 uppercase tracking-widest shadow-sm">
            Administrator Portal
          </span>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {statsLoading
          ? Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          : statCards.map((card) => (
            <StatCard key={card.label} card={card} onClick={card.onClick} />
          ))}
      </div>

      {/* Pending Approvals Section Removed */}
    </div>
  );
}

export default Dashboard;
