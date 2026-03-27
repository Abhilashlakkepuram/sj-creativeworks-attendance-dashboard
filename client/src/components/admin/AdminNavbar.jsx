import { useNavigate } from "react-router-dom";
import NotificationBell from "../common/NotificationBell";
import { useAuth } from "../../context/AuthContext";

function AdminNavbar() {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-40 shadow-sm">
            <div>
                <h1 className="font-semibold text-slate-800 text-base">Admin Portal</h1>
                <p className="text-xs text-slate-500">SJ Creativeworks Attendance System</p>
            </div>
            <div className="flex items-center gap-4">
                <NotificationBell />
                <div className="w-px h-6 bg-slate-200 mx-2"></div>
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-rose-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50"
                >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Logout
                </button>
            </div>
        </header>
    );
}

export default AdminNavbar;
