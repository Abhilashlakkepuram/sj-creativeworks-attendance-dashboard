import { useState, useEffect } from "react";
import api from "../../services/api";

const ROLES = ["all", "developer", "seo", "designer", "marketing"];
const PRIORITIES = ["low", "medium", "high"];

function PostAnnouncement() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [postLoading, setPostLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    message: "",
    priority: "medium",
    targetRole: "all"
  });

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await api.get("/announcements");
      setAnnouncements(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setPostLoading(true);
      await api.post("/announcements", form);
      setForm({ title: "", message: "", priority: "medium", targetRole: "all" });
      fetchAnnouncements();
      alert("Announcement posted successfully!");
    } catch (err) {
      alert("Failed to post announcement");
    } finally {
      setPostLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this announcement?")) return;
    try {
      await api.delete(`/announcements/${id}`);
      fetchAnnouncements();
    } catch (err) {
      alert("Failed to delete announcement");
    }
  };

  const getPriorityColor = (p) => {
    switch (p) {
      case "high": return "bg-rose-50 text-rose-600 border-rose-100";
      case "medium": return "bg-amber-50 text-amber-600 border-amber-100";
      default: return "bg-emerald-50 text-emerald-600 border-emerald-100";
    }
  };

  return (
    <div className="flex flex-col gap-8 pb-10">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-black text-slate-800 tracking-tight">Post Announcement</h2>
        <p className="text-slate-500 text-sm mt-1">Send important updates and alerts to your team members.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Post Form */}
        <div className="lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm sticky top-24">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Title</label>
              <input
                required
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-50 outline-none transition"
                placeholder="e.g., Office Holiday Notice"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Message</label>
              <textarea
                required
                rows={4}
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-50 outline-none transition resize-none"
                placeholder="Write your announcement details here..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-50 outline-none capitalize"
                >
                  {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-1">Target Role</label>
                <select
                  value={form.targetRole}
                  onChange={(e) => setForm({ ...form, targetRole: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-4 focus:ring-primary-50 outline-none capitalize"
                >
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={postLoading}
              className="w-full py-4 bg-primary-600 text-white font-black rounded-2xl hover:bg-primary-700 transition shadow-lg shadow-primary-100 disabled:opacity-50"
            >
              {postLoading ? "Posting..." : "POST NOW"}
            </button>
          </form>
        </div>

        {/* List of Previous Announcements */}
        <div className="lg:col-span-7 space-y-4">
          <h3 className="text-lg font-black text-slate-800 tracking-tight pl-1 mb-4">Recent Announcements</h3>
          {loading ? (
            <div className="text-slate-400 text-center py-20 italic">Loading history...</div>
          ) : announcements.length === 0 ? (
            <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl p-12 text-center">
              <p className="text-slate-400 font-bold">No announcements found.</p>
            </div>
          ) : (
            announcements.map((a) => (
              <div key={a._id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:border-primary-100 transition-all duration-300 group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex gap-2">
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${getPriorityColor(a.priority)}`}>
                      {a.priority}
                    </span>
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-500 rounded-lg text-[10px] font-black uppercase tracking-widest border border-slate-200">
                      {a.targetRole}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] items-center text-slate-400 font-bold uppercase tracking-widest">
                      {new Date(a.createdAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short' })}
                    </span>
                    <button
                      onClick={() => handleDelete(a._id)}
                      className="text-rose-400 hover:text-rose-600 transition p-1 hover:bg-rose-50 rounded"
                      title="Delete Announcement"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                <h4 className="text-lg font-black text-slate-800 mb-1 group-hover:text-primary-600 transition-colors uppercase">{a.title}</h4>
                <p className="text-slate-500 text-sm leading-relaxed">{a.message}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default PostAnnouncement;