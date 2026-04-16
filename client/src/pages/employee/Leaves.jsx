import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import { useSocket } from "../../socket/SocketContext";
import Badge from "../../components/ui/Badge";

function Leaves() {
  // Form State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("paid");
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // History & Filter State
  const [myLeaves, setMyLeaves] = useState([]);
  const [fetchingLeaves, setFetchingLeaves] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [balanceData, setBalanceData] = useState({ balance: 0, maxLimit: 6, monthlyCredit: 2 });

  const { socket } = useSocket();
  const today = new Date().toISOString().split("T")[0];

  const fetchMyLeaves = async () => {
    try {
      setFetchingLeaves(true);
      const [leavesRes, balanceRes] = await Promise.all([
        api.get("/leaves/my-leaves"),
        api.get("/leaves/balance")
      ]);
      setMyLeaves(leavesRes.data.data || []);
      if (balanceRes.data.success) {
        setBalanceData({
          balance: balanceRes.data.balance,
          maxLimit: balanceRes.data.maxLimit,
          monthlyCredit: balanceRes.data.monthlyCredit
        });
      }
    } catch (error) {
      console.error("Failed to fetch leaves or balance", error);
    } finally {
      setFetchingLeaves(false);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
    if (socket) {
      socket.on("leave-update", fetchMyLeaves);
      return () => socket.off("leave-update", fetchMyLeaves);
    }
  }, [socket]);

  // Helper: Calculate days between dates (inclusive)
  const calculateDays = (start, end) => {
    const s = new Date(start);
    const e = new Date(end);
    const diff = Math.abs(e - s);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  // Summary Logic
  const stats = useMemo(() => {
    const total = balanceData.maxLimit;
    const approved = myLeaves.filter(l => l.status === "approved");
    const taken = approved.reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);
    const pending = myLeaves.filter(l => l.status === "pending").length;

    return {
      total,
      taken,
      remaining: balanceData.balance,
      pending
    };
  }, [myLeaves, balanceData]);

  // Filtered List
  const filteredLeaves = useMemo(() => {
    const sorted = [...myLeaves].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filterStatus === "all") return sorted;
    return sorted.filter(l => l.status === filterStatus);
  }, [myLeaves, filterStatus]);

  const submitLeave = async (e) => {
    e.preventDefault();
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (start < now) {
      alert("Leave start date cannot be in the past.");
      return;
    }
    if (end < start) {
      alert("Leave end date cannot be before the start date.");
      return;
    }

    const requestedDays = calculateDays(startDate, endDate);
    if (leaveType === "paid" && requestedDays > balanceData.balance) {
      alert(`Insufficient balance. You need ${requestedDays} days but only have ${balanceData.balance} days left.`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/leaves/request", { startDate, endDate, reason, leaveType });
      setStartDate("");
      setEndDate("");
      setReason("");
      setLeaveType("paid");
      setShowModal(false);
      fetchMyLeaves();
    } catch (error) {
      alert(error.response?.data?.message || "Error submitting leave");
    } finally {
      setSubmitting(false);
    }
  };

  const statusConfig = {
    pending: { bg: "bg-yellow-100", text: "text-yellow-700", label: "Pending" },
    approved: { bg: "bg-green-100", text: "text-green-700", label: "Approved" },
    rejected: { bg: "bg-red-100", text: "text-red-700", label: "Rejected" }
  };

  return (
    <div className="max-w-7xl mx-auto flex flex-col gap-8 pb-12 px-4">

      {/* ───────────────── TOP HEADER & ACTION ───────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Leave Management</h1>
          <p className="text-slate-500 font-medium">Track and apply for your leaves in one place.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          Apply for Leave
        </button>
      </div>

      {/* ───────────────── SUMMARY CARDS ───────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Total Leaves", val: stats.total, color: "blue" },
          { label: "Leaves Taken", val: stats.taken, color: "emerald" },
          { label: "Remaining", val: stats.remaining, color: "indigo" },
          { label: "Pending Requests", val: stats.pending, color: "amber" },
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
            <h3 className={`text-4xl font-black text-${card.color}-600 tracking-tight`}>{card.val}</h3>
          </div>
        ))}
      </div>

      {/* ───────────────── HISTORY SECTION ───────────────── */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">

        {/* Table Toolbar */}
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Leave History
            <span className="px-2 py-1 bg-slate-100 text-slate-500 text-[10px] rounded-lg">{filteredLeaves.length}</span>
          </h2>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {["all", "pending", "approved", "rejected"].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all capitalize ${filterStatus === status
                    ? "bg-white text-primary-600 shadow-sm"
                    : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Table or Empty State */}
        <div className="overflow-x-auto">
          {fetchingLeaves && filteredLeaves.length === 0 ? (
            <div className="p-24 flex flex-col items-center justify-center gap-4">
              <span className="w-10 h-10 border-4 border-slate-100 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Fetching records...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="p-24 text-center">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-slate-100/50">
                <svg className="w-10 h-10 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 mb-1">No Leave Requests</h3>
              <p className="text-slate-400 text-sm font-medium">Your request history will appear once you submit an application.</p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Date Range</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Type</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Days</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Reason</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Applied On</th>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLeaves.map((l) => (
                  <tr key={l._id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-8 py-6 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center text-primary-600">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-700">
                              {new Date(l.startDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="text-slate-300 font-light">→</span>
                            <span className="font-bold text-slate-700">
                              {new Date(l.endDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] border ${
                        l.leaveType === 'unpaid' 
                          ? 'bg-slate-50 text-slate-400 border-slate-100' 
                          : 'bg-primary-50 text-primary-600 border-primary-100'
                      }`}>
                        {l.leaveType || 'paid'}
                      </span>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-lg font-black text-[10px]">
                        {calculateDays(l.startDate, l.endDate)}D
                      </span>
                    </td>
                    <td className="px-8 py-6 max-w-xs">
                      <p className="text-sm text-slate-600 font-medium truncate" title={l.reason}>
                        {l.reason}
                      </p>
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-400 italic">
                      {new Date(l.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <span className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-full ${statusConfig[l.status]?.bg || "bg-slate-100"} ${statusConfig[l.status]?.text || "text-slate-600"}`}>
                          {l.status}
                        </span>
                        {/* Show rejection reason icon if exists */}
                        {l.status === 'rejected' && l.rejectionReason && (
                          <div className="group relative">
                            <svg className="w-4 h-4 text-rose-400 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                              Note: {l.rejectionReason}
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ───────────────── APPLY LEAVE MODAL ───────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowModal(false)} />

          <div className="relative bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-10 transform animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-10">
              <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Apply for Leave</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Submit your request to HR for approval.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2.5 hover:bg-slate-100 rounded-2xl text-slate-400 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitLeave} className="space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Start Date</label>
                  <input
                    type="date"
                    min={today}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">End Date</label>
                  <input
                    type="date"
                    min={startDate || today}
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Leave Type</label>
                <div className="relative group">
                  <select
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all appearance-none cursor-pointer"
                    value={leaveType}
                    onChange={(e) => setLeaveType(e.target.value)}
                    required
                  >
                    <option value="paid">Paid Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                  </select>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="text-[10px] font-bold text-slate-400 pl-1 mt-1 transition-all">
                  {leaveType === 'paid' 
                    ? `Available balance: ${balanceData.balance} days` 
                    : "Note: This will be treated as an unpaid absence."}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Reason for Leave</label>
                <textarea
                  className="w-full bg-slate-50 border border-slate-100 rounded-[28px] px-6 py-5 text-sm font-medium focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all h-36 resize-none leading-relaxed"
                  placeholder="Tell us why you need this leave..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-6 py-4 bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-4 rounded-2xl shadow-xl shadow-primary-200/50 disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Submit Request
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Leaves;
