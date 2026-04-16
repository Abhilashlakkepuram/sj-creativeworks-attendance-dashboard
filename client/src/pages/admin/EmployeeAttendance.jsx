import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import jsPDF from "jspdf";
import "jspdf-autotable";
import autoTable from "jspdf-autotable";

function EmployeeAttendance() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [data, setData] = useState([]);
    const [employee, setEmployee] = useState(null);
    const [loading, setLoading] = useState(true);
    const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
    const [summary, setSummary] = useState(null);

    // ───────────────── FETCH DATA ─────────────────
    const fetchData = async () => {
        try {
            setLoading(true);

            const res = await api.get(`/admin/attendance/user/${id}?month=${month}`);
            const attendanceData = res.data.data || [];

            setData(attendanceData);
            setSummary(res.data.summary);

            // Robust employee info extraction
            if (res.data.employee) {
                setEmployee(res.data.employee);
            } else {
                // Fallback: fetch profile separately
                try {
                    const empRes = await api.get(`/admin/employee/${id}`);
                    setEmployee(empRes.data);
                } catch (profileErr) {
                    // Final fallback to populated record if available
                    if (attendanceData.length > 0 && attendanceData[0].user?.name) {
                        setEmployee(attendanceData[0].user);
                    }
                }
            }

        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [id, month]);

    // ───────────────── CALCULATE HOURS ─────────────────
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

    // ───────────────── PDF DOWNLOAD ─────────────────
    const downloadPDF = () => {
        if (!data.length) {
            alert("No attendance data to export");
            return;
        }

        const doc = new jsPDF();

        // Header
        doc.setFontSize(18);
        doc.text("SJ Creativeworks", 14, 18);

        doc.setFontSize(12);
        doc.text("Employee Attendance Report", 14, 26);

        doc.text(`Name: ${employee?.name || "-"}`, 14, 34);
        doc.text(`Email: ${employee?.email || "-"}`, 14, 40);

        const tableColumn = [
            "Date",
            "Punch In",
            "Punch Out",
            "Hours",
            "Status",
        ];

        const tableRows = data.map((d) => {
            const hours =
                d.punchIn && d.punchOut
                    ? ((new Date(d.punchOut) - new Date(d.punchIn)) / (1000 * 60 * 60)).toFixed(2)
                    : "-";

            return [
                new Date(d.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }),
                d.punchIn ? new Date(d.punchIn).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "-",
                d.punchOut ? new Date(d.punchOut).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" }) : "-",
                hours,
                d.status,
            ];
        });

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 50,
            theme: "grid",
        });

        doc.save(`attendance_${employee?.name || "employee"}.pdf`);
    };

    // ───────────────── UI ─────────────────
    if (loading) {
        return (
            <div className="p-10 text-center text-slate-500">
                Loading attendance...
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6 max-w-6xl mx-auto pb-10">

            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate("/admin/employees")}
                        className="p-2.5 bg-white border border-slate-200 text-slate-500 hover:text-primary-600 rounded-xl transition shadow-sm group"
                        title="Back to Directory"
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
                            {employee?.email || "Detailed attendance history"}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <input
                        type="month"
                        value={month}
                        onChange={(e) => setMonth(e.target.value)}
                        className="bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary-500 transition-all outline-none"
                    />
                    <button
                        onClick={() => navigate(`/admin/employee/${id}`)}
                        className="flex-1 md:flex-none bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-slate-50 transition shadow-sm flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        View Profile
                    </button>
                    <button
                        onClick={downloadPDF}
                        className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6m-6 4h6" />
                        </svg>
                        Download PDF
                    </button>
                </div>
            </div>

            {/* Summary Analytics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                    { label: "Attendance Rate", val: `${summary?.attendanceRate ?? 0}%`, color: "text-primary-600", bg: "bg-primary-50/30" },
                    { label: "Late Days", val: summary?.late ?? 0, color: "text-amber-600", bg: "bg-amber-50/30" },
                    { label: "Half Days", val: summary?.halfDay ?? 0, color: "text-blue-600", bg: "bg-blue-50/30" },
                    { label: "Missed Punch-Out", val: summary?.missedPunchOut ?? 0, color: "text-rose-600", bg: "bg-rose-50/30" },
                ].map((card, idx) => (
                    <div key={idx} className={`${card.bg} p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all`}>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{card.label}</p>
                        <h3 className={`text-2xl font-black ${card.color}`}>{card.val}</h3>
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">

                    <thead className="bg-slate-50 text-slate-400 text-xs font-bold uppercase">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Punch In</th>
                            <th className="px-6 py-4">Punch Out</th>
                            <th className="px-6 py-4">Hours</th>
                            <th className="px-6 py-4">Work Type</th>
                            <th className="px-6 py-4 text-right">Status</th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-sm">

                        {data.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-20 text-center text-slate-400">
                                    No records found
                                </td>
                            </tr>
                        ) : (
                            data.map((d) => (
                                <tr key={d._id} className="hover:bg-slate-50">

                                    <td className="px-6 py-4 font-medium">
                                        {new Date(d.date).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}
                                    </td>

                                    <td className="px-6 py-4 text-slate-500">
                                        {d.punchIn ? new Date(d.punchIn).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' }) : "-"}
                                    </td>

                                    <td className="px-6 py-4 text-slate-500">
                                        {d.punchOut ? new Date(d.punchOut).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: '2-digit', minute: '2-digit' }) : "-"}
                                    </td>

                                    <td className="px-6 py-4 text-slate-700 font-medium">
                                        {calculateHours(d.punchIn, d.punchOut)}
                                    </td>

                                    <td className="px-6 py-4">
                                        <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">
                                            {d.workType || "Full Day"}
                                        </span>
                                    </td>

                                    <td className="px-6 py-4 text-right">
                                        <span
                                            className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border shadow-sm ${d.status === "absent"
                                                ? "bg-rose-50 text-rose-600 border-rose-100"
                                                : d.status === "late"
                                                    ? "bg-amber-50 text-amber-600 border-amber-100"
                                                    : d.status === "half-day"
                                                        ? "bg-blue-50 text-blue-600 border-blue-100"
                                                        : d.status === "missed punch-out"
                                                            ? "bg-orange-50 text-orange-600 border-orange-100"
                                                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                                                }`}
                                        >
                                            {d.status}
                                        </span>
                                    </td>

                                </tr>
                            ))
                        )}

                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default EmployeeAttendance;