import { useEffect, useState, useCallback } from "react";
import api from "../../services/api";
import { moodEmoji } from "../../utils/shiftUtils";

const STATUS_OPTIONS = ["all", "pending", "approved", "flagged"];

const STATUS_STYLE = {
  pending:  "bg-amber-50 text-amber-700 border border-amber-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  flagged:  "bg-red-50 text-red-700 border border-red-200",
};

const SLOTS_BEFORE_LUNCH = 3; // slot indexes 0-2

// ── helper ──────────────────────────────────────────────────────────────────
const todayISO = () => new Date().toLocaleDateString("en-CA");

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ── Detail Modal ─────────────────────────────────────────────────────────────
function ReportModal({ reportId, onClose, onStatusChange }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [adminNote, setAdminNote] = useState("");
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    api.get(`/reports/${reportId}`)
      .then((r) => setReport(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [reportId]);

  const handleAction = async (status) => {
    setActioning(true);
    try {
      const res = await api.patch(`/reports/${reportId}/status`, { status, adminNote });
      setReport(res.data.report);
      onStatusChange(reportId, res.data.report.status);
    } catch (err) {
      alert(err.response?.data?.message || "Action failed");
    } finally {
      setActioning(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="text-lg font-black text-slate-900">Daily Report Detail</h3>
            <p className="text-xs text-slate-500">Employee Daily Performance</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm animate-pulse">Loading…</div>
        ) : !report ? (
          <div className="py-20 text-center text-slate-400">Report not found.</div>
        ) : (
          <div className="p-6 flex flex-col gap-5">
            {/* Employee + meta */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                {initials(report.employeeId?.name || report.employeeName)}
              </div>
              <div className="flex-1">
                <p className="font-black text-slate-900">{report.employeeId?.name || report.employeeName}</p>
                <p className="text-xs text-slate-400">{report.employeeId?.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">
                  {new Date(report.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </p>
                <p className="text-xs text-slate-400">
                  Submitted {new Date(report.submittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
                <p className="text-sm mt-0.5">{moodEmoji(report.moodRating)} Mood {report.moodRating}/5</p>
              </div>
            </div>

            {report.isLeave && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
                <span className="text-blue-700 font-bold">🌴 Employee marked as Leave for today</span>
              </div>
            )}

            {/* Hour slots */}
            {!report.isLeave && report.hours && (
              <div className="flex flex-col gap-2">
                {report.hours.map((h, i) => (
                  <div key={i}>
                    {i === SLOTS_BEFORE_LUNCH && (
                      <div className="my-2 flex items-center gap-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <div className="flex-1 h-px bg-slate-200" />
                        🍽 Lunch Break 1:00 – 2:00 PM
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex gap-3 items-start">
                      <span className="min-w-[100px] text-[11px] font-black text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2 py-1 text-center">
                        {h.slot}
                      </span>
                      <div className="flex-1 flex flex-col gap-1">
                        <p className="text-sm text-slate-700">{h.tasksCompleted || "No tasks reported."}</p>
                        {h.blockers && (
                          <span className="text-xs text-red-600 mt-1">
                            ⚠ {h.blockers}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {report.hours.length === 0 && (
                  <p className="text-center text-slate-400 text-sm py-4">No hours reported.</p>
                )}
              </div>
            )}

            {/* Overall notes */}
            {report.overallNotes && (
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overall Notes</p>
                <p className="text-sm text-slate-700">{report.overallNotes}</p>
              </div>
            )}

            {/* Admin action */}
            {report.status !== "pending" ? (
              <div className={`rounded-xl border p-4 text-sm ${STATUS_STYLE[report.status]}`}>
                <p className="font-bold capitalize">{report.status} by {report.adminActionBy}</p>
                {report.adminNote && <p className="mt-1 opacity-80">{report.adminNote}</p>}
                <p className="text-xs opacity-60 mt-1">
                  {report.adminActionAt && new Date(report.adminActionAt).toLocaleString()}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Admin Note <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder="Leave a note for the employee…"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction("approved")}
                    disabled={actioning}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50"
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleAction("flagged")}
                    disabled={actioning}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-bold py-2.5 rounded-xl transition disabled:opacity-50"
                  >
                    ⚑ Flag
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function ReportsViewer() {
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);

  // Filters
  const [date, setDate] = useState(todayISO());
  const [employeeId, setEmployeeId] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const LIMIT = 10;

  // Fetch employee list for dropdown
  useEffect(() => {
    api.get("/admin/employees", { params: { limit: 200 } })
      .then((r) => setEmployees(r.data.data || []))
      .catch(console.error);
  }, []);

  // Fetch reports
  const fetchReports = useCallback(async (pg = 1) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: LIMIT };
      if (date) params.date = date;
      if (employeeId) params.employeeId = employeeId;
      if (status !== "all") params.status = status;

      const res = await api.get("/reports", { params });
      setReports(res.data.data || []);
      setTotal(res.data.total || 0);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [date, employeeId, status]);

  useEffect(() => {
    setPage(1);
    fetchReports(1);
  }, [date, employeeId, status, fetchReports]);

  const handleStatusChange = (id, newStatus) => {
    setReports((prev) =>
      prev.map((r) => (r._id === id ? { ...r, status: newStatus } : r))
    );
  };

  // ── CSV Export ──────────────────────────────────────────────────────────────
  const exportCSV = () => {
    if (!reports.length) return;
    const header = ["Employee", "Date", "Slot", "Tasks Completed", "Blockers", "Overall Notes", "Mood", "Status", "Is Leave"];
    const rows = [];
    reports.forEach((r) => {
      const name = r.employeeId?.name || r.employeeName || "";
      const d = new Date(r.date).toLocaleDateString("en-CA");
      const isLeave = r.isLeave ? "Yes" : "No";
      
      if (r.hours && r.hours.length > 0) {
        r.hours.forEach((h) => {
          rows.push([
            name, d, h.slot,
            `"${(h.tasksCompleted || "").replace(/"/g, '""')}"`,
            `"${(h.blockers || "").replace(/"/g, '""')}"`,
            `"${(r.overallNotes || "").replace(/"/g, '""')}"`,
            r.moodRating, r.status, isLeave,
          ]);
        });
      } else {
        rows.push([
          name, d, "-", "-", "-",
          `"${(r.overallNotes || "").replace(/"/g, '""')}"`,
          r.moodRating, r.status, isLeave,
        ]);
      }
    });
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports_${date || todayISO()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Daily Reports</h2>
          <p className="text-slate-500 text-sm mt-1">Review and action employee daily performance reports</p>
        </div>
        <button
          onClick={exportCSV}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
        {/* Date */}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-teal-400 transition"
        />

        {/* Employee */}
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:ring-2 focus:ring-teal-400 transition"
        >
          <option value="">All employees</option>
          {employees.map((e) => (
            <option key={e._id} value={e._id}>{e.name}</option>
          ))}
        </select>

        {/* Status tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl gap-0.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all capitalize ${
                status === s
                  ? "bg-white text-teal-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        <span className="ml-auto text-xs text-slate-400 font-medium">{total} report{total !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-sm animate-pulse">Loading reports…</div>
        ) : reports.length === 0 ? (
          <div className="py-20 text-center text-slate-400 text-sm">No reports found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase">
              <tr>
                <th className="px-5 py-4 text-left">Employee</th>
                <th className="px-5 py-4 text-left">Date</th>
                <th className="px-5 py-4 text-center">Mood</th>
                <th className="px-5 py-4 text-center">Status/Leave</th>
                <th className="px-5 py-4 text-center">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {reports.map((r) => (
                <tr key={r._id} className="hover:bg-slate-50/60 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                        {initials(r.employeeId?.name || r.employeeName)}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{r.employeeId?.name || r.employeeName}</p>
                        <p className="text-xs text-slate-400">{r.employeeId?.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-slate-600 font-medium">
                    {new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-5 py-4 text-center text-xl">{moodEmoji(r.moodRating)}</td>
                  <td className="px-5 py-4 text-center">
                    {r.isLeave ? (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 border border-blue-100 rounded text-[10px] font-bold uppercase">Leave</span>
                    ) : (
                      <span className="text-xs text-slate-400">{r.hours?.length || 0} slots</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${STATUS_STYLE[r.status]}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <button
                      onClick={() => setSelectedId(r._id)}
                      className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} total reports</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setPage((p) => Math.max(1, p - 1)); fetchReports(page - 1); }}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >← Prev</button>
            <span className="px-3 py-1.5 bg-teal-600 text-white rounded-lg font-bold text-xs">{page} / {totalPages}</span>
            <button
              onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); fetchReports(page + 1); }}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >Next →</button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedId && (
        <ReportModal
          reportId={selectedId}
          onClose={() => setSelectedId(null)}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}
