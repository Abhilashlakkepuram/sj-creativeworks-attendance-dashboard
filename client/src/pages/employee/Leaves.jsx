import { useState, useEffect } from "react";
import api from "../../services/api";
import { useSocket } from "../../socket/SocketContext";

function Leaves() {
  // Form State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // History State
  const [myLeaves, setMyLeaves] = useState([]);
  const [fetchingLeaves, setFetchingLeaves] = useState(true);

  const { socket } = useSocket();

  const today = new Date().toISOString().split("T")[0];

  const fetchMyLeaves = async () => {
    try {
      setFetchingLeaves(true);
      const res = await api.get("/leaves/my-leaves");
      setMyLeaves(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch leaves", error);
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

    setLoading(true);

    try {
      const res = await api.post("/leaves/request", {
        startDate,
        endDate,
        reason
      });

      // alert(res.data.message);
      setStartDate("");
      setEndDate("");
      setReason("");
      fetchMyLeaves(); 
    } catch (error) {
      alert(error.response?.data?.message || "Error submitting leave");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 max-w-7xl mx-auto items-start pb-12">
      
      {/* ───────────────── LEFT: REQUEST FORM ───────────────── */}
      <div className="w-full lg:w-1/3 flex flex-col gap-6 sticky top-8">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Request Leave</h2>
          <p className="text-sm text-slate-500 mt-2">Submit a new leave application to your manager.</p>
        </div>

        <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-100">
          <form onSubmit={submitLeave} className="space-y-6">
            
            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2 pl-1">
                  Start Date
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all font-bold text-slate-700"
                  value={startDate}
                  min={today}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    if (endDate && e.target.value > endDate) {
                      setEndDate("");
                    }
                  }}
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2 pl-1">
                  End Date
                </label>
                <input
                  type="date"
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all font-bold text-slate-700"
                  value={endDate}
                  min={startDate || today}
                  onChange={(e) => setEndDate(e.target.value)}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black tracking-widest uppercase text-slate-400 mb-2 pl-1">
                Reason for Leave
              </label>
              <textarea
                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all resize-none h-32 leading-relaxed"
                placeholder="State the reason of your absence clearly..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-bold px-6 py-3.5 rounded-xl transition-all shadow-lg shadow-primary-200/50 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Submit Application
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* ───────────────── RIGHT: HISTORY LIST ───────────────── */}
      <div className="w-full lg:w-2/3 flex flex-col gap-6">
        <div className="flex justify-between items-end">
          <div>
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight">Leave History</h2>
            <p className="text-sm text-slate-500 mt-2">Track the status of your recent applications.</p>
          </div>
          <div className="px-4 py-2 bg-white rounded-xl border border-slate-100 shadow-sm text-xs font-bold text-slate-500">
            Total Requests: {myLeaves.length}
          </div>
        </div>

        <div className="flex flex-col gap-4 min-h-[400px]">
          {fetchingLeaves && myLeaves.length === 0 ? (
            <div className="flex items-center justify-center flex-1 bg-white rounded-3xl border border-slate-100 border-dashed">
              <span className="w-8 h-8 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
            </div>
          ) : myLeaves.length === 0 ? (
            <div className="flex flex-col items-center justify-center flex-1 bg-white rounded-3xl border border-slate-100 border-dashed py-20">
               <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-slate-500 font-bold">No leave requests found.</p>
              <p className="text-sm text-slate-400 mt-1">Your detailed history will appear here.</p>
            </div>
          ) : (
            myLeaves.map((leave) => (
              <div key={leave._id} className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 flex flex-col gap-5 hover:shadow-md transition-shadow">
                {/* Top Headers */}
                <div className="flex justify-between items-start">
                  <div className="flex flex-wrap gap-3 text-sm">
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="font-bold text-slate-700">
                        {new Date(leave.startDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <span className="text-slate-300 mt-1.5">to</span>
                    <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100">
                      <span className="font-bold text-slate-700">
                        {new Date(leave.endDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  </div>

                  <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg border flex-shrink-0 ${
                    leave.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                    leave.status === 'rejected' ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                    'bg-amber-50 text-amber-600 border-amber-100'
                  }`}>
                    {leave.status}
                  </span>
                </div>

                {/* Content */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">Submitted Reason</span>
                    <p className="text-sm text-slate-600 bg-slate-50/50 p-4 rounded-xl border border-slate-100 leading-relaxed italic">
                      "{leave.reason}"
                    </p>
                  </div>
                  
                  {/* Rejection block if present */}
                  {leave.status === 'rejected' && leave.rejectionReason && (
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest text-rose-400 mb-1.5">Admin Comments</span>
                      <p className="text-sm text-rose-700 bg-rose-50/50 p-4 rounded-xl border border-rose-100 leading-relaxed">
                        {leave.rejectionReason}
                      </p>
                    </div>
                  )}
                </div>

                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest border-t border-slate-50 pt-4 mt-1">
                  Requested on {new Date(leave.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      
    </div>
  );
}

export default Leaves;
