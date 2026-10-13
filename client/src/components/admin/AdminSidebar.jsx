import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth";
import logo from "../../assets/visionthoughts.logo.jpeg";

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

function AdminSidebar({ isOpen, onClose }) {
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
    <div className={`w-64 h-screen bg-slate-900 text-white fixed left-0 top-0 z-50 flex flex-col transform transition-transform duration-300 lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}>

      <div className="h-16 flex items-center px-4 border-b border-slate-800 gap-2">
        <div className="bg-white rounded-lg p-1.5 w-full max-w-[190px]">
          <img src={logo} className="w-full h-auto" alt="Vision Thoughts" />
        </div>
        <button type="button" onClick={onClose} className="ml-auto p-2 text-slate-400 hover:text-white lg:hidden" aria-label="Close menu">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18 18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            onClick={onClose}
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
