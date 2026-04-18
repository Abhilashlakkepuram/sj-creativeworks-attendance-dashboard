import { useEffect, useState, useContext } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import { calculateLeaveDays, formatLeaveDate } from "../../utils/leaveDate";

function LeaveRequests() {
  const socket = useContext(SocketContext);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  // Rejection Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [selectedLeaveId, setSelectedLeaveId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");

  // Smart day count—prefers selectedDates over range
  const getDisplayDays = (leave) => {
    if (leave.selectedDates?.length > 0) return leave.selectedDates.length;
    return calculateLeaveDays(leave.startDate, leave.endDate);
  };

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

  const rejectLeave = (id) => {
    setSelectedLeaveId(id);
    setIsRejectModalOpen(true);
    setRejectionReason("");
  };

  const confirmReject = async () => {
    setLoading(true);
    try {
      await api.patch(`/leaves/reject/${selectedLeaveId}`, { rejectionReason });
      setIsRejectModalOpen(false);
      fetchLeaves();
    } catch {
      alert("Error rejecting leave");
    } finally {
      setLoading(false);
    }
  };

  const filteredLeaves = leaves.filter(l => {
    if (filterStatus === "all") return true;
    return l.status === filterStatus;
  });

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Leave Requests</h2>
          <p className="mt-1 text-slate-500 font-medium">Review and manage staff leave requests</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60 shadow-sm transition-all duration-300">
          {[
            { id: "all", label: "All", color: "bg-slate-200 text-slate-600 border-slate-300" },
            { id: "pending", label: "Pending", color: "bg-amber-100 text-amber-600 border-amber-200" },
            { id: "approved", label: "Approved", color: "bg-emerald-100 text-emerald-600 border-emerald-200" },
            { id: "rejected", label: "Rejected", color: "bg-rose-100 text-rose-600 border-rose-200" }
          ].map((btn) => (
            <button
              key={btn.id}
              onClick={() => setFilterStatus(btn.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 border ${filterStatus === btn.id
                  ? `${btn.color} shadow-sm border-transparent`
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-600 hover:bg-white/80"
                }`}
            >
              {btn.label}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${filterStatus === btn.id ? "bg-white/50" : "bg-slate-100"
                }`}>
                {btn.id === "all" ? leaves.length : leaves.filter(l => l.status === btn.id).length}
              </span>
            </button>
          ))}
        </div>
      </div>

      {filteredLeaves.length === 0 ? (
        <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-20 text-center transition-all duration-500 animate-in fade-in zoom-in-95">
          <div className="w-20 h-20 bg-slate-50/80 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-50 shadow-inner">
            <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-slate-800">No {filterStatus !== "all" ? `${filterStatus} ` : ""}requests</h3>
          <p className="text-slate-400 font-medium mt-1">Leave records will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-12">
          {filteredLeaves.map((leave) => (
            <div key={leave._id} className="bg-white rounded-[32px] shadow-sm border border-slate-100 p-7 flex flex-col hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-500 group relative overflow-hidden">
              {/* Type Badge Background Deco */}
              <div className={`absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 rounded-full opacity-[0.03] transition-all duration-500 group-hover:scale-150 ${leave.leaveType === "unpaid" ? "bg-slate-900" : "bg-blue-600"
                }`} />

              {/* Header */}
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary-600 font-black text-xl border border-slate-100 group-hover:bg-primary-50 group-hover:border-primary-100 transition-all duration-300 shadow-sm">
                    {leave.user?.name?.charAt(0) || "?"}
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 leading-tight flex items-center gap-2">
                      {leave.user?.name || "Unknown"}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{leave.user?.role || "Staff"}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-200" />
                      <span className={`px-2 py-0.5 text-[9px] font-black uppercase tracking-widest rounded-md border ${leave.leaveType === "unpaid"
                          ? "bg-slate-50 text-slate-500 border-slate-200"
                          : "bg-blue-50 text-blue-600 border-blue-100"
                        }`}>
                        {leave.leaveType || "paid"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 text-[10px] font-black rounded-xl uppercase tracking-widest shadow-sm border whitespace-nowrap ${leave.status === "approved" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                    leave.status === "rejected" ? "bg-rose-50 text-rose-700 border-rose-100" :
                      "bg-amber-50 text-amber-700 border-amber-100"
                    }`}>
                    {leave.status}
                  </span>
                  <span className="text-[9px] font-bold text-slate-300 uppercase tracking-tighter">
                    {new Date(leave.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                  </span>
                </div>
              </div>

              {/* Dates & Duration */}
              <div className="flex flex-col gap-3 mb-6 bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {leave.selectedDates?.length > 0 ? (
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Selected Dates</span>
                        <div className="flex flex-wrap gap-1.5">
                          {leave.selectedDates.slice(0, 4).map((d, i) => (
                            <span key={i} className="text-[10px] font-bold bg-primary-50 text-primary-600 border border-primary-100 px-2 py-0.5 rounded-md">
                              {formatLeaveDate(d, { day: "2-digit", month: "short" })}
                            </span>
                          ))}
                          {leave.selectedDates.length > 4 && (
                            <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md">
                              +{leave.selectedDates.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">Start</span>
                          <span className="text-xs font-black text-slate-700">{formatLeaveDate(leave.startDate, { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                        <svg className="w-3.5 h-3.5 text-slate-300 mt-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mb-0.5">End</span>
                          <span className="text-xs font-black text-slate-700">{formatLeaveDate(leave.endDate, { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="px-3 py-1.5 bg-white border border-slate-100 rounded-xl shadow-sm text-[11px] font-black text-primary-600 shrink-0">
                    {getDisplayDays(leave)} Days
                  </div>
                </div>

                {/* Requested By (on behalf) */}
                {leave.appliedFor === "other" && leave.requestedBy && (
                  <div className="pt-2 border-t border-slate-200/50 flex items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Requested by:</span>
                    <span className="text-[10px] font-bold text-slate-600">{leave.requestedBy?.name || "Admin"}</span>
                    <span className="ml-auto px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md">On Behalf</span>
                  </div>
                )}

                {/* Decision Context Helper */}
                {leave.status === "pending" && (
                  <div className="pt-2 border-t border-slate-200/50 flex items-center gap-2">
                    <svg className="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] font-bold text-slate-500 italic">
                      {leave.leaveType === "unpaid"
                        ? "Unpaid leave (no balance impact)"
                        : `This will deduct ${getDisplayDays(leave)} days from employee balance`}
                    </span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div className="flex-1 flex flex-col gap-4">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-slate-200"></span>
                    Reason for Leave
                  </div>
                  <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100 group-hover:border-slate-200 transition-colors">
                    <p className="text-slate-600 text-[13px] leading-relaxed italic">
                      "{leave.reason}"
                    </p>
                  </div>
                </div>

                {leave.status === "rejected" && leave.rejectionReason && (
                  <div>
                    <div className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <span className="w-4 h-px bg-rose-200"></span>
                      Rejection Reason
                    </div>
                    <div className="bg-rose-50/30 rounded-2xl p-4 border border-rose-100/50">
                      <p className="text-rose-600 text-[13px] leading-relaxed italic">
                        "{leave.rejectionReason}"
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="mt-6 pt-6 border-t border-slate-100 relative z-10">
                {leave.status === "pending" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => approveLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 text-xs font-black rounded-xl hover:bg-emerald-600 hover:text-white disabled:opacity-50 transition-all duration-300 border border-emerald-100 shadow-sm shadow-emerald-100/20 active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                      Approve
                    </button>
                    <button
                      onClick={() => rejectLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 text-xs font-black rounded-xl hover:bg-rose-600 hover:text-white disabled:opacity-50 transition-all duration-300 border border-rose-100 shadow-sm shadow-rose-100/20 active:scale-95"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Reject
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <svg className="w-3.5 h-3.5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Processed
                    </div>
                    <button
                      onClick={() => deleteLeave(leave._id)}
                      disabled={loading}
                      className="flex items-center gap-2 px-3 py-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all duration-300 text-[10px] font-black uppercase tracking-widest border border-transparent hover:border-rose-100 active:scale-95"
                      title="Delete Record"
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

      {/* ───────────────── CUSTOM REJECTION MODAL ───────────────── */}
      {isRejectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsRejectModalOpen(false)}
          />

          <div className="relative bg-white rounded-[32px] w-full max-w-md shadow-2xl p-8 transform animate-in zoom-in-95 duration-200 border border-slate-100">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Reject Leave</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Please provide a reason for rejection.</p>
              </div>
              <button
                onClick={() => setIsRejectModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">
                  Rejection Reason (Optional)
                </label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium text-slate-700 focus:ring-4 focus:ring-rose-50 focus:border-rose-400 outline-none transition-all h-32 resize-none leading-relaxed"
                  placeholder="E.g., High workload during this period..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRejectModalOpen(false)}
                  className="flex-1 px-6 py-3.5 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmReject}
                  disabled={loading}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-3.5 rounded-2xl shadow-lg shadow-rose-200 disabled:opacity-50 transition-all active:scale-95 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Confirm Reject"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveRequests;
