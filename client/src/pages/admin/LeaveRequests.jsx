import { useEffect, useState, useContext } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";

function LeaveRequests() {
  const socket = useContext(SocketContext);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchLeaves = async () => {
    try {
      const res = await api.get("/leaves/all");
      setLeaves(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const approveLeave = async (id) => {
    setLoading(true);
    try {
      await api.patch(`/leaves/approve/${id}`);
      alert("Leave approved!");
      fetchLeaves();
    } catch {
      alert("Error approving leave");
    } finally {
      setLoading(false);
    }
  };

  const rejectLeave = async (id) => {
    if (!window.confirm("Are you sure you want to reject this leave request?")) return;
    setLoading(true);
    try {
      await api.patch(`/leaves/reject/${id}`);
      fetchLeaves();
    } catch {
      alert("Error rejecting leave");
    } finally {
      setLoading(false);
    }
  };

  const deleteLeave = async (id) => {
    if (!window.confirm("Are you sure you want to delete this leave record? This action cannot be undone.")) return;
    setLoading(true);
    try {
      await api.delete(`/leaves/delete/${id}`);
      fetchLeaves();
    } catch {
      alert("Error deleting leave request");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaves();

    if (socket) {
      socket.on("leave-update", fetchLeaves);
      return () => socket.off("leave-update", fetchLeaves);
    }
  }, [socket]);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Leave Requests</h2>
          <p className="mt-1 text-slate-500">Review and manage staff leave requests</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-xs font-medium text-slate-600">Pending: {leaves.filter(l => l.status === "pending").length}</span>
          </div>
          <div className="w-px h-4 bg-slate-200"></div>
          <div className="text-xs font-medium text-slate-500">Total: {leaves.length}</div>
        </div>
      </div>

      {leaves.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-12 text-center">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-slate-500 font-medium">No leave requests found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {leaves.map((leave) => (
            <div key={leave._id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col hover:shadow-md transition-all duration-300 group">
              {/* Header */}
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-slate-50 flex items-center justify-center text-primary-600 font-bold text-lg border border-slate-100 group-hover:bg-primary-50 group-hover:border-primary-100 transition-colors">
                    {leave.user?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 leading-tight">{leave.user?.name || "Unknown"}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 font-medium uppercase tracking-tight">{leave.user?.role || "Staff"}</p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg uppercase tracking-wider shadow-sm border ${leave.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                  leave.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                    "bg-amber-50 text-amber-700 border-amber-100"
                  }`}>
                  {leave.status}
                </span>
              </div>

              {/* Dates */}
              <div className="flex items-center gap-3 text-sm text-slate-600 mb-5 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold text-slate-700">{new Date(leave.startDate).toLocaleDateString()}</span>
                </div>
                <div className="text-slate-300">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </div>
                <span className="font-semibold text-slate-700">{new Date(leave.endDate).toLocaleDateString()}</span>
              </div>

              {/* Reason */}
              <div className="flex-1 flex flex-col">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                  <span className="w-4 h-px bg-slate-200"></span>
                  Reason for Leave
                </div>
                <div className="bg-slate-50/30 rounded-2xl p-4 border border-slate-50 flex-1">
                  <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line italic">
                    "{leave.reason}"
                  </p>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="mt-6 pt-5 border-t border-slate-50">
                {leave.status === "pending" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => approveLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl hover:bg-emerald-600 hover:text-white disabled:opacity-50 transition-all duration-200 border border-emerald-100/50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => rejectLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-50 text-rose-700 text-xs font-bold rounded-xl hover:bg-rose-600 hover:text-white disabled:opacity-50 transition-all duration-200 border border-rose-100/50"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                      <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Processed
                    </div>
                    <button
                      onClick={() => deleteLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all text-[10px] font-bold uppercase tracking-tight"
                      title="Delete Request"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LeaveRequests;
