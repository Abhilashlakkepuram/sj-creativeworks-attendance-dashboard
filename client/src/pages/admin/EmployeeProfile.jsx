import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";



function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [leaveBalance, setLeaveBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch profile, attendance, leaves, and balance in parallel
        const [profileRes, attendanceRes, leavesRes, balanceRes] = await Promise.all([
          api.get(`/admin/employee/${id}`),
          api.get(`/admin/attendance/user/${id}`),
          api.get(`/leaves/user/${id}`),
          api.get(`/leaves/balance/${id}`)
        ]);

        setEmployee(profileRes.data);
        setAttendance(attendanceRes.data.data || attendanceRes.data);
        setLeaves(leavesRes.data.data || []);
        setLeaveBalance(balanceRes.data);
      } catch (err) {
        console.error("Error fetching employee data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);



  // Stats calculation (current month)
  const stats = useMemo(() => {
    if (!attendance.length) return { present: 0, late: 0, total: 0 };
    const now = new Date();
    const currentMonth = attendance.filter(r => {
      const d = new Date(r.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      present: currentMonth.filter(r => r.status === "present").length,
      late: currentMonth.filter(r => r.status === "late").length,
      total: currentMonth.length
    };
  }, [attendance]);

  // Leave stats calculation
  const calculateDays = (start, end) => {
    const diff = new Date(end) - new Date(start);
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
  };

  const leaveStats = useMemo(() => {
    const approvedPaidLeaves = leaves.filter(l => l.status === "approved" && l.leaveType === "paid");
    const used = approvedPaidLeaves.reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);
    const pending = leaves.filter(l => l.status === "pending").length;

    return {
      used,
      pending,
      remaining: leaveBalance?.balance || 0,
      max: leaveBalance?.maxLimit || 6
    };
  }, [leaves, leaveBalance]);

  // Performance calculation (Current Month)
  const performanceData = useMemo(() => {
    const now = new Date();
    // 1. Attendance Score (70%)
    const attendanceScore = stats.total > 0 ? (stats.present / stats.total) * 70 : 0;

    // 2. Leave Penalty (Monthly)
    const currentMonthLeaves = leaves.filter(l => {
      const d = new Date(l.startDate);
      return l.status === "approved" && l.leaveType === "paid" &&
        d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const monthlyUsed = currentMonthLeaves.reduce((sum, l) => sum + calculateDays(l.startDate, l.endDate), 0);
    const leavePenalty = monthlyUsed * 2;

    // 3. Final Score
    const rawScore = attendanceScore - leavePenalty;
    const score = Math.max(0, Math.min(100, Math.round(rawScore)));

    let label = "Poor";
    let color = "text-rose-600";
    let bg = "bg-rose-50/50";
    let border = "border-rose-100";

    if (score >= 85) {
      label = "Excellent"; color = "text-emerald-600"; bg = "bg-emerald-50/50"; border = "border-emerald-100";
    } else if (score >= 70) {
      label = "Good"; color = "text-primary-600"; bg = "bg-primary-50/50"; border = "border-primary-100";
    } else if (score >= 50) {
      label = "Average"; color = "text-amber-600"; bg = "bg-amber-50/50"; border = "border-amber-100";
    }

    return { score, label, color, bg, border };
  }, [stats, leaves]);

  const calculateHours = (inTime, outTime) => {
    if (!inTime || !outTime) return "—";
    const diff = new Date(outTime) - new Date(inTime);
    let minutes = Math.floor(diff / (1000 * 60));
    // Product-level logic: deduct 1 hour break if they worked more than 4 hours (240 mins)
    if (minutes > 240) {
      minutes -= 60;
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };



  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="w-10 h-10 border-4 border-primary-100 border-t-primary-600 rounded-full animate-spin" />
    </div>
  );

  if (!employee) return (
    <div className="bg-rose-50 border border-rose-100 p-8 rounded-3xl text-center text-rose-600">
      <p className="font-bold text-lg">Employee profile not found</p>
      <button onClick={() => navigate("/admin/employees")} className="mt-4 text-sm font-bold underline">Go back to Staff Directory</button>
    </div>
  );

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20 px-4">

      {/* Header & Back Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/admin/employees")}
          className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-bold text-sm transition group"
        >
          <div className="w-8 h-8 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center group-hover:bg-primary-50 group-hover:border-primary-100 transition-all">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          </div>
          Back to Directory
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Profile & Attendance Summary */}
        <div className="lg:col-span-1 flex flex-col gap-8">
          {/* Profile Card */}
          <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm p-8 flex flex-col items-center text-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary-600/5 rounded-full -mr-16 -mt-16 transition-transform duration-700 group-hover:scale-150" />

            <div className="w-24 h-24 rounded-3xl bg-primary-600 text-white flex items-center justify-center font-black text-4xl shadow-2xl shadow-primary-200 mb-6 relative z-10 border-4 border-white">
              {employee.name?.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{employee.name}</h2>
            <p className="text-slate-500 font-medium mb-6">{employee.email}</p>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="px-4 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary-100">
                {employee.role}
              </span>
              <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${employee.isBlocked ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                }`}>
                {employee.isBlocked ? "Blocked" : "Active"}
              </span>
            </div>

            <div className="w-full pt-8 border-t border-slate-50 space-y-5">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Joined</span>
                <span className="text-slate-700 font-bold text-sm bg-slate-50 px-3 py-1 rounded-lg">{new Date(employee.createdAt).toLocaleDateString("en-IN", { month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Employee ID</span>
                <span className="text-slate-900 font-mono text-xs font-black bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">{employee._id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Attendance Summary Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-4 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Attendance Overview
            </h2>
            <div className="grid grid-cols-1 gap-4">
              {[
                { label: "Working Days", val: stats.total, color: "text-slate-900", bg: "bg-white", sub: "Current month" },
                { label: "Present Days", val: stats.present, color: "text-emerald-600", bg: "bg-emerald-50/30", sub: "Confirmed entries" },
                { label: "Late Arrivals", val: stats.late, color: "text-amber-600", bg: "bg-amber-50/30", sub: "Target improvement" },
              ].map((item, idx) => (
                <div key={idx} className={`${item.bg} rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all duration-300`}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{item.label}</p>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">{item.sub}</p>
                  </div>
                  <p className={`text-3xl font-black ${item.color}`}>{item.val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Score Section */}
          <div className="flex flex-col gap-4">
            <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 pl-4 mb-2 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500"></span>
              Performance Index
            </h2>
            <div className={`rounded-[32px] p-8 border ${performanceData.border} ${performanceData.bg} shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-500`}>
              <div className="flex justify-between items-center relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Monthly Score</p>
                  <div className="flex items-baseline gap-1">
                    <h3 className={`text-5xl font-black ${performanceData.color}`}>{performanceData.score}</h3>
                    <span className={`text-xl font-black opacity-40 ${performanceData.color}`}>%</span>
                  </div>
                  <div className={`mt-4 px-3 py-1 bg-white rounded-xl inline-block border ${performanceData.border} shadow-sm`}>
                    <span className={`text-[10px] font-black uppercase tracking-widest ${performanceData.color}`}>{performanceData.label}</span>
                  </div>
                </div>

                <div className="w-20 h-20 relative">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="40" cy="40" r="36"
                      className="stroke-white/50"
                      strokeWidth="8" fill="transparent"
                    />
                    <circle
                      cx="40" cy="40" r="36"
                      className={`transition-all duration-1000 ease-out`}
                      strokeWidth="8"
                      strokeDasharray={226.19}
                      strokeDashoffset={226.19 - (226.19 * performanceData.score) / 100}
                      strokeLinecap="round"
                      fill="transparent"
                      stroke="currentColor"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg className="w-6 h-6 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Decorative background circle */}
              <div className="absolute bottom-0 right-0 w-32 h-32 -mb-16 -mr-16 bg-white/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            </div>
            <p className="text-[9px] font-medium text-slate-400 px-4 mt-1 italic">
              Score based on attendance (70%) and leave penalty (-2 per paid day).
            </p>
          </div>
        </div>

        {/* Right Column: Leave Insights & History */}
        <div className="lg:col-span-2 flex flex-col gap-10">

          <div className="flex flex-col gap-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Leave Insights</h2>
                <p className="text-slate-500 font-medium text-sm mt-1">Manage allowances and requests</p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-2xl shadow-lg shadow-slate-200">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest shadow-sm">+2 Monthly Credit</span>
              </div>
            </div>

            {/* Leave Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { label: "Max Leaves", val: leaveStats.max, color: "text-slate-400", sub: "Annual cap" },
                { label: "Used (Paid)", val: leaveStats.used, color: "text-primary-600", sub: "Sum of approved" },
                { label: "Remaining", val: leaveStats.remaining, color: "text-emerald-600", sub: "Available now" },
                { label: "Pending", val: leaveStats.pending, color: "text-amber-500", sub: "In review" },
              ].map((card, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2 truncate">{card.label}</p>
                  <h3 className={`text-3xl font-black ${card.color}`}>{card.val}</h3>
                  <div className="mt-2 w-8 h-1 bg-slate-50 rounded-full overflow-hidden">
                    <div className="w-1/2 h-full bg-slate-100 group-hover:bg-primary-100 transition-colors" />
                  </div>
                </div>
              ))}
            </div>

            {/* Leave History Table */}
            <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden flex flex-col">
              <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Leaves</h3>
                <span className="text-[10px] font-bold text-slate-400">Total: {leaves.length} records</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                    <tr>
                      <th className="px-8 py-5">Date Range</th>
                      <th className="px-6 py-5">Days</th>
                      <th className="px-6 py-5">Type</th>
                      <th className="px-6 py-5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {leaves.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="px-8 py-20 text-center opacity-30">
                          <svg className="w-12 h-12 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                          <p className="font-black text-xs uppercase tracking-widest">No leave history</p>
                        </td>
                      </tr>
                    ) : (
                      leaves.map((l) => (
                        <tr key={l._id} className="hover:bg-slate-50/80 transition-all duration-300 group">
                          <td className="px-8 py-6">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-700">
                                {new Date(l.startDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })} - {new Date(l.endDate).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                              </span>
                              <span className="text-[11px] text-slate-400 font-medium italic mt-0.5 truncate max-w-[200px]">{l.reason}</span>
                            </div>
                          </td>
                          <td className="px-6 py-6">
                            <span className="px-3 py-1.5 bg-slate-50 text-slate-900 text-xs font-black rounded-xl border border-slate-100 group-hover:bg-white transition-colors">
                              {calculateDays(l.startDate, l.endDate)}D
                            </span>
                          </td>
                          <td className="px-6 py-6">
                            <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${l.leaveType === 'unpaid'
                                ? 'bg-slate-50 text-slate-400 border-slate-200'
                                : 'bg-blue-50 text-blue-600 border-blue-100'
                              }`}>
                              {l.leaveType || 'paid'}
                            </span>
                          </td>
                          <td className="px-6 py-6 text-right">
                            <span className={`px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-sm border ${l.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                                l.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                                  'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                              {l.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeProfile;
