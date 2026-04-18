import { useState, useEffect, useMemo } from "react";
import api from "../../services/api";
import { useSocket } from "../../socket/SocketContext";
import { useAuth } from "../../context/AuthContext";
import Card, { CardContent } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { calculateLeaveDays, formatLeaveDate } from "../../utils/leaveDate";

function Leaves() {
  const { user } = useAuth();
  const socket = useSocket();

  // 📝 Form State
  const [selectedDates, setSelectedDates] = useState([]);
  const [reason, setReason] = useState("");
  const [leaveType, setLeaveType] = useState("paid");
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [appliedFor, setAppliedFor] = useState("self");
  const [targetUserId, setTargetUserId] = useState("");
  const [employees, setEmployees] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [fetchingLeaves, setFetchingLeaves] = useState(true);

  // 📅 Calendar State
  const [calendarDate, setCalendarDate] = useState(new Date());

  // 📋 History & Filter State
  const [myLeaves, setMyLeaves] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [balanceData, setBalanceData] = useState({ balance: 0, maxLimit: 6, monthlyCredit: 2 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // 🔄 Fetch Data
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

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/leaves/employees");
      setEmployees(res.data.data || []);
    } catch (error) {
      console.error("Failed to fetch employees", error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const res = await api.get("/holidays");
      setHolidays(res.data || []);
    } catch (error) {
      console.error("Failed to fetch holidays", error);
    }
  };

  useEffect(() => {
    fetchMyLeaves();
    fetchHolidays();
    if (socket) {
      socket.on("leave-update", fetchMyLeaves);
      return () => socket.off("leave-update", fetchMyLeaves);
    }
  }, [socket]);

  useEffect(() => {
    if (appliedFor === "other") fetchEmployees();
    else setTargetUserId("");
  }, [appliedFor]);

  // 🛠️ Helpers
  const getDisplayDays = (l) => {
    if (l.selectedDates?.length > 0) return l.selectedDates.length;
    return calculateLeaveDays(l.startDate, l.endDate);
  };

  const isOfficeOff = (date) => {
    // Sunday
    if (date.getDay() === 0) return true;
    // 2nd and 4th Saturday
    if (date.getDay() === 6) {
      const d = date.getDate();
      const isSecond = d >= 8 && d <= 14;
      const isFourth = d >= 22 && d <= 28;
      return isSecond || isFourth;
    }
    return false;
  };

  const isPublicHoliday = (date) => {
    const key = date.toLocaleDateString('en-CA');
    return holidays.some(h => new Date(h.date).toLocaleDateString('en-CA') === key);
  };

  const isDateDisabled = (date) => {
    if (date < today) return true;
    if (isOfficeOff(date)) return true;
    if (isPublicHoliday(date)) return true;
    return false;
  };

  const toggleDate = (date) => {
    if (isDateDisabled(date)) return;
    const key = date.toLocaleDateString('en-CA');
    setSelectedDates(prev => {
      const exists = prev.find(d => d.toLocaleDateString('en-CA') === key);
      return exists ? prev.filter(d => d.toLocaleDateString('en-CA') !== key) : [...prev, date];
    });
  };

  const renderCalendar = () => {
    const year = calendarDate.getFullYear();
    const month = calendarDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  };

  const calendarCells = renderCalendar();

  // 📊 Stats Logic
  const stats = useMemo(() => {
    const total = balanceData.maxLimit;
    const approved = myLeaves.filter(l => l.status === "approved");
    const taken = approved.reduce((sum, l) => sum + getDisplayDays(l), 0);
    const pending = myLeaves.filter(l => l.status === "pending").length;
    return { total, taken, remaining: balanceData.balance, pending };
  }, [myLeaves, balanceData]);

  // 🔍 Filter Logic
  const filteredLeaves = useMemo(() => {
    const sorted = [...myLeaves].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (filterStatus === "all") return sorted;
    return sorted.filter(l => l.status === filterStatus);
  }, [myLeaves, filterStatus]);

  // 📤 Submission
  const submitLeave = async (e) => {
    e.preventDefault();
    if (selectedDates.length === 0) return alert("Select at least one date");
    if (leaveType === "paid" && selectedDates.length > balanceData.balance) return alert("Insufficient balance");

    setSubmitting(true);
    try {
      await api.post("/leaves/request", {
        selectedDates,
        leaveType,
        reason,
        appliedFor,
        targetUserId: appliedFor === "other" ? targetUserId : undefined,
      });
      setSelectedDates([]);
      setReason("");
      setShowModal(false);
      fetchMyLeaves();
    } catch (error) {
      alert(error.response?.data?.message || "Error submitting leave");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-8 pb-12 px-4 animate-in fade-in duration-500">

      {/* ───────────────── TOP HEADER ───────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            Leave Management
            <span className="p-1.5 bg-primary-50 text-primary-600 rounded-xl transform rotate-3">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </span>
          </h1>
          <p className="text-slate-500 text-sm font-medium mt-1">
            View your balance, track approvals, and apply for new leaves.
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-primary-200 transition-all active:scale-95 flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Application
        </Button>
      </div>

      {/* ───────────────── SUMMARY STATS ───────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Remaining", val: stats.remaining, color: "indigo", icon: "💎", desc: "Paid days left" },
          { label: "Approved", val: stats.taken, color: "emerald", icon: "✅", desc: "Days taken" },
          { label: "Pending", val: stats.pending, color: "amber", icon: "⏳", desc: "Awaiting review" },
          { label: "Quota", val: stats.total, color: "blue", icon: "📅", desc: "Annual limit" },
        ].map((card, idx) => (
          <Card key={idx} className="group hover:shadow-md transition-all duration-300 rounded-3xl border-slate-100 overflow-hidden relative">
            <div className="absolute top-2 right-2 opacity-5 group-hover:scale-110 transition-transform text-3xl">
              {card.icon}
            </div>
            <CardContent className="p-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">{card.label}</p>
              <h3 className={`text-4xl font-black text-${card.color}-600 tracking-tighter mb-1`}>{card.val}</h3>
              <p className="text-[10px] font-bold text-slate-400">{card.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ───────────────── HISTORY SECTION ───────────────── */}
      <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[400px]">
        {/* Toolbar */}
        <div className="p-6 lg:p-8 border-b border-slate-50 flex flex-col lg:row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Recent Activity</h2>
            <span className="px-2.5 py-1 bg-slate-50 text-slate-400 text-[10px] font-black rounded-lg border border-slate-100 uppercase tracking-widest">
              {filteredLeaves.length} Records
            </span>
          </div>

          <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100">
            {["all", "pending", "approved", "rejected"].map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${filterStatus === s
                  ? "bg-white text-primary-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* List Content */}
        <div className="p-4 lg:p-6">
          {fetchingLeaves && filteredLeaves.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-primary-500 rounded-full animate-spin" />
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Fetching records...</p>
            </div>
          ) : filteredLeaves.length === 0 ? (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <svg className="w-8 h-8 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-black text-slate-800 tracking-tight">No records found</h3>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLeaves.map((l) => (
                <div key={l._id} className="group p-5 bg-white border border-slate-50 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:shadow-sm hover:border-slate-200 transition-all duration-300">

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-500 transition-colors">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-black text-slate-800">
                          {l.selectedDates?.length > 0
                            ? formatLeaveDate(l.selectedDates[0])
                            : formatLeaveDate(l.startDate)}
                        </h4>
                        {l.selectedDates?.length > 1 && (
                          <span className="bg-slate-50 text-slate-400 px-1.5 py-0.5 rounded text-[9px] font-bold">+{l.selectedDates.length - 1} DAYS</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 italic mt-0.5 max-w-sm line-clamp-1 truncate">
                        {l.reason || "No reason provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-6">
                    <div className="text-right flex flex-col">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border self-end ${l.leaveType === 'unpaid'
                          ? 'bg-slate-50 text-slate-400 border-slate-100'
                          : 'bg-primary-50 text-primary-600 border-primary-50'
                        }`}>
                        {l.leaveType || 'paid'}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase">{getDisplayDays(l)}D TAKE</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.1em] ${l.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                          l.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                            'bg-rose-100 text-rose-700'
                        }`}>
                        {l.status}
                      </span>
                      {l.status === 'rejected' && l.rejectionReason && (
                        <div className="group/note relative">
                          <svg className="w-4 h-4 text-rose-300 hover:text-rose-500 cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="absolute bottom-full right-0 mb-2 w-48 p-3 bg-slate-900 text-white text-[9px] rounded-xl shadow-xl opacity-0 group-hover/note:opacity-100 transition-opacity pointer-events-none z-10 leading-tight">
                            {l.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ───────────────── APPLY MODAL ───────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setShowModal(false)} />

          <div className="relative bg-white rounded-3xl w-full max-w-xl shadow-2xl p-8 lg:p-10 transform animate-in zoom-in-95 duration-300 max-h-[90vh] overflow-y-auto">

            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Apply Leave</h2>
                <p className="text-slate-500 text-sm mt-1">Select dates on the calendar.</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 transition-colors">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={submitLeave} className="space-y-6">

              {user.role === 'admin' && (
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Mode</label>
                  <div className="flex gap-2 p-1 bg-slate-50 rounded-xl border border-slate-100">
                    {["self", "other"].map(opt => (
                      <button key={opt} type="button" onClick={() => setAppliedFor(opt)}
                        className={`flex-1 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${appliedFor === opt ? "bg-white text-primary-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                          }`}>
                        {opt === "self" ? "Self" : "On Behalf"}
                      </button>
                    ))}
                  </div>
                  {appliedFor === "other" && (
                    <select className="w-full h-12 px-5 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 outline-none"
                      value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} required>
                      <option value="">Employee...</option>
                      {employees.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
                    </select>
                  )}
                </div>
              )}

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Select Dates</label>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-4 px-1">
                    <button type="button" onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-slate-900 shadow-sm border border-slate-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
                    </button>
                    <span className="text-sm font-black text-slate-900 tracking-tight">
                      {calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
                    </span>
                    <button type="button" onClick={() => setCalendarDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                      className="w-8 h-8 flex items-center justify-center bg-white rounded-lg text-slate-400 hover:text-slate-900 shadow-sm border border-slate-50">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-7 mb-2">
                    {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                      <div key={i} className={`text-center text-[9px] font-black uppercase tracking-widest py-1 ${i === 0 ? 'text-rose-400' : 'text-slate-400'}`}>{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {calendarCells.map((date, i) => {
                      if (!date) return <div key={i} />;
                      const key = date.toLocaleDateString('en-CA');
                      const disabled = isDateDisabled(date);
                      const isSelected = selectedDates.some(d => d.toLocaleDateString('en-CA') === key);
                      const isToday = date.toLocaleDateString('en-CA') === today.toLocaleDateString('en-CA');

                      return (
                        <button key={key} type="button" disabled={disabled} onClick={() => toggleDate(date)}
                          className={`h-9 w-full rounded-xl text-xs font-black transition-all ${disabled ? "text-slate-100 cursor-not-allowed" :
                              isSelected ? "bg-primary-600 text-white shadow-md shadow-primary-100" :
                                isToday ? "bg-white text-primary-600 border border-primary-100" :
                                  "bg-white text-slate-800 border border-slate-50 hover:border-primary-100 hover:text-primary-600"
                            }`}>
                          {date.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {selectedDates.sort((a, b) => a - b).map(d => (
                      <div key={d.toISOString()} className="px-2.5 py-1 bg-primary-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 animate-in zoom-in duration-300">
                        {formatLeaveDate(d)}
                        <button type="button" onClick={() => toggleDate(d)} className="hover:text-rose-200">✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Type</label>
                  <select className="w-full h-11 px-4 rounded-xl bg-slate-50 border border-slate-100 text-sm font-bold text-slate-700 outline-none"
                    value={leaveType} onChange={(e) => setLeaveType(e.target.value)}>
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Summary</label>
                  <div className="h-11 flex items-center px-4 bg-primary-50 rounded-xl border border-primary-100 font-black text-primary-700 text-xs">
                    {selectedDates.length} Days
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-1">Reason</label>
                <textarea className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-medium outline-none h-24 resize-none leading-relaxed"
                  placeholder="Brief reason..." value={reason} onChange={(e) => setReason(e.target.value)} required />
              </div>

              <div className="flex gap-4 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowModal(false)} className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest text-slate-400 text-xs shadow-none border-slate-100">Dismiss</Button>
                <Button type="submit" disabled={submitting || selectedDates.length === 0} className="flex-1 py-3.5 rounded-2xl font-black uppercase tracking-widest bg-primary-600 text-white shadow-xl shadow-primary-100 text-xs">
                  {submitting ? "..." : "Submit"}
                </Button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
}

export default Leaves;