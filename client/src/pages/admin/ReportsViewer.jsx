import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function ReportsViewer() {
    const [reports, setReports] = useState([]);
    const [employees, setEmployees] = useState([]);

    // Filters
    const [date, setDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const [employeeId, setEmployeeId] = useState('all');
    const [status, setStatus] = useState('All');

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalReports, setTotalReports] = useState(0);

    const [loading, setLoading] = useState(true);

    // Modal state
    const [selectedReport, setSelectedReport] = useState(null);
    const [adminNote, setAdminNote] = useState("");

    const fetchReports = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page,
                limit: 15,
                status
            });
            if (date) params.append('date', date);
            if (employeeId !== 'all') params.append('employeeId', employeeId);

            const res = await api.get(`/reports?${params}`);
            setReports(res.data.data);
            setTotalPages(res.data.totalPages);
            setTotalReports(res.data.total);
        } catch (error) {
            console.error("Failed to fetch reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/admin/employees?limit=100');
            setEmployees(res.data.data || []);
        } catch (error) {
            console.error("Failed to fetch employees:", error);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [page, status, date, employeeId]);

    const handleAction = async (reportId, newStatus) => {
        try {
            const res = await api.patch(`/reports/${reportId}/status`, {
                status: newStatus,
                adminNote
            });
            if (selectedReport && selectedReport._id === reportId) {
                setSelectedReport(res.data.report);
            }
            fetchReports();
            setAdminNote("");
        } catch (error) {
            console.error("Failed to update report:", error);
            alert("Failed to update status");
        }
    };

    const exportCSV = () => {
        if (!reports || reports.length === 0) return;

        const headers = ["Employee", "Date", "Slot", "Tasks Completed", "Blockers", "Overall Notes", "Status"];
        const rows = [];

        reports.forEach(report => {
            const empName = report.employeeName || report.employeeId?.name || "Unknown";
            const reportDate = new Date(report.date).toLocaleDateString();

            report.hours.forEach(hour => {
                rows.push([
                    empName,
                    reportDate,
                    hour.slot,
                    `"${(hour.tasksCompleted || '').replace(/"/g, '""')}"`,
                    `"${(hour.blockers || '').replace(/"/g, '""')}"`,
                    `"${(report.overallNotes || '').replace(/"/g, '""')}"`,
                    report.status
                ]);
            });
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `daily_reports_${date || 'all'}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const StatusBadge = ({ status }) => {
        const colors = {
            pending: "bg-amber-100 text-amber-800 border-amber-200",
            approved: "bg-emerald-100 text-emerald-800 border-emerald-200",
            flagged: "bg-rose-100 text-rose-800 border-rose-200"
        };
        const color = colors[status] || "bg-slate-100 text-slate-800";
        return <span className={`border px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest shadow-sm ${color}`}>{status}</span>;
    };

    return (
        <div className="max-w-7xl mx-auto w-full pb-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Daily Work Reports</h2>
                    <p className="text-slate-500 mt-1 font-medium">Review and action employee end-of-day summaries.</p>
                </div>
                <button
                    onClick={exportCSV}
                    className="bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md transition-all hover:shadow-lg flex items-center gap-2"
                >
                    <svg className="w-5 h-5 opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export CSV
                </button>
            </div>

            {/* FILTERS */}
            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-all flex flex-wrap items-center gap-4 mb-6">
                <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Date Filter</label>
                    <input
                        type="date"
                        value={date}
                        onChange={e => { setDate(e.target.value); setPage(1); }}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 py-2 px-4 shadow-sm text-slate-700 font-bold"
                    />
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Employee Filter</label>
                    <select
                        value={employeeId}
                        onChange={e => { setEmployeeId(e.target.value); setPage(1); }}
                        className="bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 py-2 px-4 shadow-sm text-slate-700 font-bold min-w-[200px]"
                    >
                        <option value="all">All Employees</option>
                        {employees.map(emp => (
                            <option key={emp._id} value={emp._id}>{emp.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex flex-col gap-1 w-full sm:w-auto sm:ml-auto">
                    <label className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Status</label>
                    <div className="flex bg-slate-100 p-1 rounded-lg ring-1 ring-slate-200">
                        {['All', 'Pending', 'Approved', 'Flagged'].map(s => (
                            <button
                                key={s}
                                onClick={() => { setStatus(s); setPage(1); }}
                                className={`px-4 py-1.5 rounded text-xs font-extrabold transition-all ${status === s ? 'bg-white text-indigo-700 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* TABLE */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                {loading ? (
                    <div className="py-24 text-center text-slate-400 font-medium">Fetching reports...</div>
                ) : reports.length === 0 ? (
                    <div className="py-24 text-center text-slate-400">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 ring-1 ring-slate-200">
                            <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800">No work reports found</h3>
                        <p className="text-sm">Try adjusting your filters or date.</p>
                    </div>
                ) : (
                    <table className="w-full text-left font-medium text-sm">
                        <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase font-extrabold tracking-wider border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4">Employee</th>
                                <th className="px-6 py-4">Submitted At</th>
                                <th className="px-6 py-4 px-2">Status</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {reports.map((report) => (
                                <tr key={report._id} className="hover:bg-slate-50/50 transition">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-white font-bold shadow-sm text-sm">
                                                {report.employeeName?.charAt(0).toUpperCase() || "?"}
                                            </div>
                                            <div>
                                                <p className="font-extrabold text-slate-900">{report.employeeName}</p>
                                                <p className="text-xs text-slate-500 font-bold">{new Date(report.date).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 font-bold">
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            {new Date(report.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <StatusBadge status={report.status} />
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            onClick={() => setSelectedReport(report)}
                                            className="px-5 py-2 bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 font-bold rounded-lg transition-all text-xs uppercase tracking-widest shadow-sm hover:shadow"
                                        >
                                            Inspect
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                {totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-sm">
                        <span className="text-slate-500 font-bold font-sm">{totalReports} total reports</span>
                        <div className="flex items-center gap-2">
                            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-4 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 font-bold bg-white hover:bg-slate-100 transition">Prev</button>
                            <span className="font-extrabold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg">{page} / {totalPages}</span>
                            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-4 py-1.5 border border-slate-300 rounded-lg disabled:opacity-40 font-bold bg-white hover:bg-slate-100 transition">Next</button>
                        </div>
                    </div>
                )}
            </div>

            {/* MODAL / DRAWER */}
            {selectedReport && (
                <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm" onClick={() => { setSelectedReport(null); setAdminNote(""); }}>
                    <div
                        className="w-full max-w-2xl bg-slate-50 h-full overflow-y-auto shadow-2xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 p-6 flex items-center justify-between z-10 shadow-sm">
                            <div>
                                <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">{selectedReport.employeeName}'s Report</h2>
                                <p className="text-slate-500 text-sm font-bold mt-1">Date: {new Date(selectedReport.date).toLocaleDateString()}</p>
                            </div>
                            <button onClick={() => { setSelectedReport(null); setAdminNote(""); }} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="p-8">
                            <div className="mb-8 flex items-center gap-8 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Current Status</p>
                                    <StatusBadge status={selectedReport.status} />
                                </div>
                                <div className="border-l border-slate-200 pl-8">
                                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Time Logged</p>
                                    <p className="text-sm font-extrabold text-slate-800">{new Date(selectedReport.submittedAt).toLocaleTimeString()}</p>
                                </div>
                            </div>

                            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-4 px-2">Deliverables Breakdown</h3>

                            <div className="flex flex-col gap-5">
                                {selectedReport.hours.map((hour, idx) => {
                                    const isLunch = idx === 3;
                                    return (
                                        <div key={idx}>
                                            {isLunch && (
                                                <div className="flex items-center gap-4 py-4 px-2 opacity-50">
                                                    <hr className="flex-1 border-t-2 border-dashed border-slate-300" />
                                                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest bg-slate-200/50 px-4 py-1.5 rounded border border-slate-300">
                                                        Lunch Break: 13:00 - 14:00
                                                    </span>
                                                    <hr className="flex-1 border-t-2 border-dashed border-slate-300" />
                                                </div>
                                            )}
                                            <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 relative group hover:border-slate-300 transition-all">
                                                <div className="font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3 py-1 rounded inline-block text-[10px] mb-3 uppercase tracking-widest">
                                                    {hour.slot}
                                                </div>
                                                <div className="mb-2">
                                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Action Items</h4>
                                                    <p className="text-sm text-slate-800 font-medium whitespace-pre-wrap leading-relaxed">{hour.tasksCompleted}</p>
                                                </div>
                                                {hour.blockers && (
                                                    <div className="mt-4 bg-rose-50/50 p-4 rounded-lg border border-rose-100/50">
                                                        <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                            Impediments
                                                        </h4>
                                                        <p className="text-xs text-rose-800 font-bold">{hour.blockers}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {selectedReport.overallNotes && (
                                <div className="mt-8 bg-slate-900 p-6 rounded-xl border border-slate-800 text-white shadow-lg">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">End-of-Day Summary</h3>
                                    <p className="text-sm text-slate-300 font-medium whitespace-pre-wrap leading-relaxed">{selectedReport.overallNotes}</p>
                                </div>
                            )}

                            {selectedReport.adminNote && (
                                <div className="mt-6 bg-slate-100 p-6 rounded-xl border border-slate-200">
                                    <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Previous Administrative Feedback</h3>
                                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{selectedReport.adminNote}</p>
                                </div>
                            )}

                            <div className="mt-10 pt-8 border-t border-slate-200">
                                <h3 className="text-sm font-extrabold uppercase tracking-widest text-slate-800 mb-4">Supervisory Actions</h3>
                                <div className="flex flex-col gap-4">
                                    <textarea
                                        className="w-full text-sm font-medium p-4 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none placeholder-slate-400"
                                        placeholder="Append formal notes before modifying status..."
                                        value={adminNote}
                                        onChange={e => setAdminNote(e.target.value)}
                                    />
                                    <div className="flex gap-4">
                                        <button
                                            onClick={() => handleAction(selectedReport._id, 'approved')}
                                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3.5 rounded-lg font-black uppercase tracking-widest text-xs transition-all shadow-md hover:shadow-lg"
                                        >
                                            Mark Approved
                                        </button>
                                        <button
                                            onClick={() => handleAction(selectedReport._id, 'flagged')}
                                            className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-3.5 rounded-lg font-black uppercase tracking-widest text-xs transition-all shadow-md hover:shadow-lg"
                                        >
                                            Flag Report
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
