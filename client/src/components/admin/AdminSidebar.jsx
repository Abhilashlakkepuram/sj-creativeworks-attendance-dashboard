import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import logo from "../../assets/sj-logo.png"

const navItems = [
  { name: "Dashboard", path: "/admin/dashboard" },
  { name: "Staff", path: "/admin/employees" },
  { name: "Attendance Monitor", path: "/admin/attendance" },
  { name: "Leave Requests", path: "/admin/leaves" },
  { name: "Holidays", path: "/admin/holidays" },
  { name: "Reports", path: "/admin/reports" },
  { name: "Daily Reports", path: "/admin/daily-reports" },
  { name: "Chat", path: "/admin/chat" },
  { name: "Notifications", path: "/admin/notifications" },
  { name: "Announcements", path: "/admin/announcements" },
];

function AdminSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const isActive = (path) =>
    location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  return (
    <div className="w-64 h-screen bg-slate-900 text-white fixed left-0 top-0 flex flex-col">

      <div className="h-16 flex items-center px-6 border-b border-slate-800  gap-2">
        <img src={logo} className="w-10 h-10 " alt="" />
        SJ Creativeworks
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`block px-4 py-2 rounded-lg ${isActive(item.path)
              ? "bg-primary-600"
              : "hover:bg-slate-800"
              }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {/* Profile Section */}
      <div className="p-4 border-t border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center text-sm font-bold shadow-sm ring-1 ring-white/10 text-white">
            {user?.name?.charAt(0).toUpperCase() || "A"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate text-white">
              {user?.name || "Admin"}
            </p>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider truncate">
              Administrator
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default AdminSidebar;