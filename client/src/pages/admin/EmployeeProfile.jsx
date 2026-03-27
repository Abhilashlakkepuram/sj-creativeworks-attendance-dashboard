import { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS_FILTERS = ["all", "present", "late", "absent"];

function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDate, setFilterDate] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch profile and attendance in parallel
        const [profileRes, attendanceRes] = await Promise.all([
          api.get(`/admin/employee/${id}`),
          api.get(`/admin/attendance/user/${id}`)
        ]);

        setEmployee(profileRes.data);
        // Ensure data is handled correctly whether it's wrapped in {data:[]} or a direct array
        setAttendance(attendanceRes.data.data || attendanceRes.data);
      } catch (err) {
        console.error("Error fetching employee data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Client-side filtering
  const filteredAttendance = useMemo(() => {
    return attendance.filter(record => {
      const matchStatus = filterStatus === "all" || record.status === filterStatus;
      const matchDate = !filterDate || new Date(record.date).toISOString().split('T')[0] === filterDate;
      return matchStatus && matchDate;
    });
  }, [attendance, filterStatus, filterDate]);

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

  const downloadCSV = () => {
    const headers = ["Date", "Punch In", "Punch Out", "Work Hours", "Status"];
    const rows = filteredAttendance.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.punchIn ? new Date(r.punchIn).toLocaleTimeString() : "-",
      r.punchOut ? new Date(r.punchOut).toLocaleTimeString() : "-",
      r.workHours || "-",
      r.status
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `attendance_${employee?.name || 'employee'}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(`Attendance Report: ${employee.name}`, 14, 22);
    doc.setFontSize(11);
    doc.text(`Employee ID: ${employee._id}`, 14, 30);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 38);

    const tableColumn = ["Date", "Punch In", "Punch Out", "Work Hours", "Status"];
    const tableRows = filteredAttendance.map(r => [
      new Date(r.date).toLocaleDateString(),
      r.punchIn ? new Date(r.punchIn).toLocaleTimeString() : "-",
      r.punchOut ? new Date(r.punchOut).toLocaleTimeString() : "-",
      r.workHours || "-",
      r.status.toUpperCase()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`attendance_${employee.name.replace(/\s+/g, '_')}.pdf`);
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
    <div className="flex flex-col gap-8 max-w-6xl mx-auto pb-20">

      {/* Header & Back Action */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/admin/employees")}
          className="flex items-center gap-2 text-slate-500 hover:text-primary-600 font-bold text-sm transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" /></svg>
          Back to Directory
        </button>
        <div className="flex gap-3">
          <button
            onClick={downloadCSV}
            className="bg-white border border-slate-200 text-slate-700 px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
          >
            <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            CSV
          </button>
          <button
            onClick={downloadPDF}
            className="bg-white border border-slate-200 text-slate-700 px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-50 transition shadow-sm"
          >
            <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6m-6 4h6" /></svg>
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Profile Column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Profile Card */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-8 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-primary-600 text-white flex items-center justify-center font-bold text-4xl shadow-xl shadow-primary-100 mb-6">
              {employee.name?.charAt(0).toUpperCase()}
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">{employee.name}</h2>
            <p className="text-slate-500 font-medium mb-4">{employee.email}</p>

            <div className="flex flex-wrap justify-center gap-2 mb-8">
              <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-[10px] font-black uppercase tracking-wider border border-primary-100">
                {employee.role}
              </span>
              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${employee.isBlocked ? "bg-rose-50 text-rose-700 border-rose-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
                }`}>
                {employee.isBlocked ? "Blocked" : "Active"}
              </span>
            </div>

            <div className="w-full pt-6 border-t border-slate-50 space-y-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Joined</span>
                <span className="text-slate-700 font-bold">{new Date(employee.createdAt).toLocaleDateString("en-IN", { month: 'short', year: 'numeric' })}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Employee ID</span>
                <span className="text-slate-700 font-mono text-xs">{employee._id.slice(-6).toUpperCase()}</span>
              </div>
            </div>
          </div>

          {/* Stats Bar */}
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-3xl p-8 text-white shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest opacity-50 mb-6">This Month Progress</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-3xl font-black">{stats.total}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Total Days</p>
              </div>
              <div>
                <p className="text-3xl font-black text-emerald-400">{stats.present}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Present</p>
              </div>
              <div className="col-span-2 pt-4 border-t border-white/10">
                <p className="text-3xl font-black text-amber-400">{stats.late}</p>
                <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mt-1">Late Arrivals</p>
              </div>
            </div>
          </div>
        </div>

        {/* History Column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[600px] flex flex-col">

            {/* Table Filters */}
            <div className="p-6 border-b border-slate-50 flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50/30">
              <div className="flex gap-2">
                {STATUS_FILTERS.map(s => (
                  <button
                    key={s}
                    onClick={() => setFilterStatus(s)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition ${filterStatus === s ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 hover:text-slate-600 border border-slate-100"}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-white border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-primary-100 transition"
              />
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50">
                  <tr>
                    <th className="px-8 py-5">Date</th>
                    <th className="px-6 py-5">Punch In</th>
                    <th className="px-6 py-5">Punch Out</th>
                    <th className="px-6 py-5">Hours</th>
                    <th className="px-6 py-5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredAttendance.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="px-8 py-20 text-center opacity-30">
                        <svg className="w-12 h-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <p className="font-bold">No attendance records found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAttendance.map((record) => (
                      <tr key={record._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-700">{new Date(record.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                        <td className="px-6 py-5 font-medium text-slate-500">{record.punchIn ? new Date(record.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
                        <td className="px-6 py-5 font-medium text-slate-500">{record.punchOut ? new Date(record.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}</td>
                        <td className="px-6 py-5 font-bold text-slate-900">{record.workHours || "—"}</td>
                        <td className="px-6 py-5 text-right">
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tighter ${record.status === "late" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                            }`}>
                            {record.status}
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
  );
}

export default EmployeeProfile;
