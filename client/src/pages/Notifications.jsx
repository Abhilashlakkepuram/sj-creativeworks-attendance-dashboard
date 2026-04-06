import { useState, useEffect } from "react";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatDistanceToNow } from "date-fns";

const typeIcons = {
  attendance: "📅",
  leave: "📝",
  system: "⚙️",
  chat: "💬",
  registration: "👤",
};

const typeLabels = {
  attendance: "Attendance",
  leave: "Leave Request",
  system: "System Update",
  chat: "Message",
  registration: "Account Request",
};

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState("all"); // 'all' or 'unread'
  const [loading, setLoading] = useState(true);
  const { role } = useAuth();
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications/my");
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch("/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const markAsRead = async (id) => {
    try {
      await api.patch(`/notifications/read/${id}`);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
    } catch (err) {
      console.error("Failed to mark as read:", err);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((prev) => prev.filter((n) => n._id !== id));
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  const deleteAllNotifications = async () => {
    if (!window.confirm("Are you sure you want to delete all notifications? This cannot be undone.")) return;
    try {
      await api.delete("/notifications/all");
      setNotifications([]);
    } catch (err) {
      console.error("Failed to delete all notifications:", err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "unread") return !n.isRead;
    return true;
  });

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Notifications</h2>
          <p className="mt-1 text-slate-500 text-sm">Stay updated with the latest activity across the portal</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={markAllRead}
            className="px-4 py-2 text-sm font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
          >
            Mark all read
          </button>
          <button
            onClick={deleteAllNotifications}
            className="px-4 py-2 text-sm font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md shadow-rose-200"
          >
            Clear all
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setFilter("all")}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
            filter === "all" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter("unread")}
          className={`px-4 py-1.5 text-sm font-semibold rounded-lg transition-all ${
            filter === "unread" ? "bg-white text-primary-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
          }`}
        >
          Unread
          {notifications.some(n => !n.isRead) && (
            <span className="ml-2 w-2 h-2 rounded-full bg-rose-500 inline-block"></span>
          )}
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-20 text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto"></div>
            <p className="mt-4 text-slate-400 text-sm font-medium">Crunching notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-20 text-center">
            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
            </div>
            <p className="text-lg font-bold text-slate-800">No notifications found</p>
            <p className="text-slate-500 mt-2 max-w-xs mx-auto text-sm">
              {filter === "unread" 
                ? "You're all caught up! No unread notifications here." 
                : "Your notification history is empty. We'll let you know when things happen."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredNotifications.map((notif) => (
              <div
                key={notif._id}
                onClick={() => {
                  if (!notif.isRead) markAsRead(notif._id);
                  
                  let targetLink = notif.link;

                  // Support dynamic role-based path for chat if link is generic or wrong
                  if (notif.type === "chat") {
                    targetLink = role === "admin" ? "/admin/chat" : "/employee/chat";
                  }

                  if (!targetLink) {
                    targetLink = 
                      notif.type === "attendance" ? (role === "admin" ? "/admin/attendance" : "/employee/attendance") :
                      notif.type === "leave" ? (role === "admin" ? "/admin/leaves" : "/employee/leaves") :
                      notif.type === "registration" ? "/admin/employees" :
                      notif.type === "announcement" ? (role === "admin" ? "/admin/dashboard" : "/employee/dashboard") :
                      (role === "admin" ? "/admin/dashboard" : "/employee/dashboard");
                  }
                  
                  if (targetLink) navigate(targetLink);
                }}
                className={`group flex items-start gap-4 p-6 transition-all duration-200 cursor-pointer ${
                  !notif.isRead ? "bg-primary-50/40" : "hover:bg-slate-50/80"
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl shadow-sm border border-white transition-transform group-hover:scale-110 ${
                   !notif.isRead ? "bg-white" : "bg-slate-50"
                }`}>
                  {typeIcons[notif.type] || "🔔"}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md">
                      {typeLabels[notif.type] || "General"}
                    </span>
                    {!notif.isRead && (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-600 text-[10px] font-bold uppercase rounded-md">
                        New
                      </span>
                    )}
                  </div>
                  <p className={`text-base leading-relaxed ${!notif.isRead ? "text-slate-900 font-bold" : "text-slate-600 font-medium"}`}>
                    {notif.message}
                  </p>
                  <p className="text-xs text-slate-400 mt-2 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                  </p>
                </div>

                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                  {!notif.isRead && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notif._id);
                      }}
                      className="p-2 text-slate-400 hover:text-primary-600 transition-colors"
                      title="Mark as read"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNotification(notif._id);
                    }}
                    className="p-2 text-slate-400 hover:text-rose-600 transition-colors"
                    title="Delete notification"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Notifications;
