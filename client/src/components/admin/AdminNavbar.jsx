import { useNavigate } from "react-router-dom";
import NotificationBell from "../common/NotificationBell";
import { useAuth } from "../../context/useAuth";

function AdminNavbar({ onOpen }) {
    const navigate = useNavigate();
    const { logout } = useAuth();

    const handleLogout = () => {
        logout();
        navigate("/");
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-3">
                <button type="button" onClick={onOpen} className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden" aria-label="Open menu">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div>
                    <h1 className="font-semibold text-slate-800 text-base">Admin Portal</h1>
                    <p className="hidden sm:block text-xs text-slate-500">Vision Thoughts Attendance System</p>
                </div>
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
                    <span className="hidden sm:inline">Logout</span>
                </button>
            </div>
        </header>
    );
}

export default AdminNavbar;
