import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── Helpers ───────────────────────────────────────────────────────────────────
const formatTime = (dt) =>
  dt ? new Date(dt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

const formatDate = (dt) =>
  new Date(dt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

const calcHours = (punchIn, punchOut) => {
  if (!punchIn || !punchOut) return null;
  const diff = new Date(punchOut) - new Date(punchIn);
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
};

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status, missedPunchOut }) => {
  const base = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider";
  const styles = {
    present: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    late: "bg-amber-50 text-amber-700 border border-amber-200",
    absent: "bg-rose-50 text-rose-700 border border-rose-200",
  };
  return (
    <span className={`${base} ${styles[status] || styles.absent}`}>
      {status === "present" && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />}
      {status === "late" && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />}
      {status === "absent" && <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />}
      {status}
      {missedPunchOut && (
        <span className="ml-1 bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded text-[9px] font-black uppercase">
          No Punch Out
        </span>
      )}
    </span>
  );
};

// ── Stat card ─────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, color }) => (
  <div className={`rounded-xl border p-4 flex flex-col gap-1 ${color}`}>
    <span className="text-2xl font-black">{value ?? "—"}</span>
    <span className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</span>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
function EmployeeAttendance() {
  const { id } = useParams();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();

  const [data, setData] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState("all"); // all | present | late | absent | missed
  const LIMIT = 30;

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchData = async (pg = 1) => {
    try {
      setLoading(true);
      const endpoint = id ? `/admin/attendance/user/${id}` : "/attendance/my-attendance";
      const res = await api.get(endpoint, {
        params: { page: pg, limit: LIMIT }
      });

      const payload = res.data;
      const records = payload.data || (Array.isArray(payload) ? payload : []);
      const emp = payload.employee;
      const sum = payload.summary;
      const tp = payload.totalPages;
      const t = payload.total;

      setData(records);

      if (emp) {
        setEmployee(emp);
      } else if (id) {
        // Fetch profile if id exists (admin view)
        try {
          const empRes = await api.get(`/admin/employee/${id}`);
          setEmployee(empRes.data);
        } catch (e) {
          if (records?.length > 0 && records[0].user?.name) setEmployee(records[0].user);
        }
      } else {
        // Use current user (employee view)
        setEmployee(currentUser);
      }
      setSummary(sum);
      setTotalPages(tp || 1);
      setTotal(t || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(page); }, [id, page]);

  // ── Filtered view (client-side on current page) ───────────────────────────
  const filtered = data.filter(d => {
    if (filter === "all") return true;
    if (filter === "missed") return d.missedPunchOut;
    return d.status === filter;
  });

  // ── PDF Export ────────────────────────────────────────────────────────────
  const downloadPDF = () => {
    if (!data.length) return alert("No data to export");
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("SJ Creativeworks", 14, 16);
    doc.setFontSize(11);
    doc.text("Employee Attendance Report", 14, 23);
    doc.text(`Name: ${employee?.name || "—"}`, 14, 30);
    doc.text(`Email: ${employee?.email || "—"}`, 14, 36);

    if (summary) {
      doc.text(
        `Present: ${summary.present}  Late: ${summary.late}  Absent: ${summary.absent}  Missed Punch-Out: ${summary.missedPunchOut}`,
        14, 43
      );
    }

    autoTable(doc, {
      head: [["Date", "Punch In", "Punch Out", "Hours", "Status", "Note"]],
      body: data.map(d => [
        formatDate(d.date),
        formatTime(d.punchIn),
        formatTime(d.punchOut),
        calcHours(d.punchIn, d.punchOut) || "—",
        d.status,
        d.missedPunchOut ? "Missed punch-out" : ""
      ]),
      startY: 50,
      theme: "grid",
      headStyles: { fillColor: [30, 139, 141] },
      alternateRowStyles: { fillColor: [248, 250, 252] }
    });

    doc.save(`attendance_${employee?.name || "employee"}.pdf`);
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate("/admin/employees")}
            className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary-600 rounded-xl transition shadow-sm group"
          >
            <svg className="w-5 h-5 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              {employee?.name || "Employee Attendance"}
            </h2>
            <p className="text-sm text-slate-500 font-medium">
              {employee?.email || "Full attendance history"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => navigate(`/admin/employee/${id}`)}
            className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            View Profile
          </button>
          <button
            onClick={downloadPDF}
            className="flex-1 md:flex-none bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export PDF
          </button>
        </div>
      </div>

      {/* ── Summary Stats ── */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <StatCard label="Total Days" value={summary.total} color="bg-slate-50 border-slate-200 text-slate-700" />
          <StatCard label="Present" value={summary.present} color="bg-emerald-50 border-emerald-200 text-emerald-700" />
          <StatCard label="Late" value={summary.late} color="bg-amber-50 border-amber-200 text-amber-700" />
          <StatCard label="Absent" value={summary.absent} color="bg-rose-50 border-rose-200 text-rose-700" />
          <StatCard label="Missed Punch-Out" value={summary.missedPunchOut} color="bg-orange-50 border-orange-200 text-orange-700" />
        </div>
      )}

      {/* ── Filter Tabs ── */}
      <div className="flex gap-2 flex-wrap">
        {["all", "present", "late", "absent", "missed"].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border transition ${filter === f
              ? "bg-teal-600 text-white border-teal-600"
              : "bg-white text-slate-500 border-slate-200 hover:border-teal-400"
              }`}
          >
            {f === "missed" ? "Missed Punch-Out" : f}
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm">Loading attendance…</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Day</th>
                <th className="px-6 py-4">Punch In</th>
                <th className="px-6 py-4">Punch Out</th>
                <th className="px-6 py-4">Hours</th>
                <th className="px-6 py-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-slate-400">
                    No records found
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const hours = calcHours(d.punchIn, d.punchOut);
                  const isAbsent = d.status === "absent";
                  const isWeekend = new Date(d.date).getDay() === 0;

                  return (
                    <tr
                      key={d._id}
                      className={`hover:bg-slate-50 transition ${isAbsent ? "bg-rose-50/40" : isWeekend ? "bg-slate-50/60" : ""
                        }`}
                    >
                      <td className="px-6 py-4 font-semibold text-slate-800">
                        {formatDate(d.date)}
                      </td>
                      <td className="px-6 py-4 text-slate-500">
                        {new Date(d.date).toLocaleDateString("en-IN", { weekday: "short" })}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isAbsent ? (
                          <span className="text-slate-300">—</span>
                        ) : (
                          formatTime(d.punchIn)
                        )}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {isAbsent ? (
                          <span className="text-slate-300">—</span>
                        ) : d.missedPunchOut ? (
                          <span className="text-orange-500 font-semibold text-xs">Auto-Closed</span>
                        ) : (
                          formatTime(d.punchOut)
                        )}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {hours || <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <StatusBadge status={d.status} missedPunchOut={d.missedPunchOut} />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} total records</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-xs">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmployeeAttendance;