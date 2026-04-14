import { useEffect, useState, useContext } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const STATUS = ["all", "present", "late", "absent"];

const getLocalISOString = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function AttendanceMonitor() {
  const socket = useContext(SocketContext);
  const [data, setData] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedDates, setExpandedDates] = useState({});

  const calculateHours = (inTime, outTime, workMinutes) => {
    if (workMinutes !== undefined && workMinutes !== null) {
      const h = Math.floor(workMinutes / 60);
      const m = workMinutes % 60;
      return `${h}h ${m}m`;
    }
    if (!inTime || !outTime) return "—";
    const diff = new Date(outTime) - new Date(inTime);
    let minutes = Math.floor(diff / (1000 * 60));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h ${m}m`;
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();

      if (status !== "all") params.append("status", status);
      if (search) params.append("search", search);
      if (date) params.append("date", date);
      params.append("limit", "1000"); // Ensure we request all records for the monitor

      const res = await api.get(`/admin/attendance?${params}`);
      const payloadData = res.data.data || [];
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const enrichedData = payloadData.map(d => {
        const recordDate = new Date(d.date || d.punchIn || d.createdAt);
        recordDate.setHours(0, 0, 0, 0);
        if (d.punchIn && !d.punchOut && recordDate < startOfToday) {
          return { ...d, missedPunchOut: true };
        }
        return d;
      });

      setData(enrichedData);

      // Initialize all dates as expanded by default
      const grouped = groupAttendanceByDate(enrichedData);
      const initialExpanded = {};
      Object.keys(grouped).forEach(d => {
        initialExpanded[d] = true;
      });
      setExpandedDates(initialExpanded);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();

    if (socket) {
      socket.on("attendance-update", fetchAttendance);
      return () => socket.off("attendance-update", fetchAttendance);
    }
  }, [status, search, date, socket]);

  const groupAttendanceByDate = (attendanceData) => {
    return attendanceData.reduce((groups, record) => {
      const rawDate = record.date || record.punchIn || record.createdAt;
      if (!rawDate) return groups;

      const dateKey = getLocalISOString(rawDate);

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(record);
      return groups;
    }, {});
  };

  const formatDateHeader = (dateStr) => {
    if (dateStr === 'Unknown') return 'Unknown Date';

    const now = new Date();
    const today = getLocalISOString(now);

    const yestDate = new Date(now);
    yestDate.setDate(yestDate.getDate() - 1);
    const yesterday = getLocalISOString(yestDate);

    if (dateStr === today) return 'Today';
    if (dateStr === yesterday) return 'Yesterday';

    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const toggleDate = (dateKey) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  const downloadPDF = () => {
    if (data.length === 0) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("Global Attendance Report", 14, 22);
    doc.setFontSize(11);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 30);
    doc.text(`Filters: Status: ${status}, Search: ${search || 'None'}, Date: ${date || 'All'}`, 14, 38);

    const tableColumn = ["Employee", "Email", "Punch In", "Punch Out", "Hours", "Status"];
    const tableRows = data.map(item => [
      item.user?.name || "-",
      item.user?.email || "-",
      item.punchIn ? new Date(item.punchIn).toLocaleTimeString() : "-",
      item.punchOut ? new Date(item.punchOut).toLocaleTimeString() : "-",
      calculateHours(item.punchIn, item.punchOut),
      item.status.toUpperCase()
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] }
    });

    doc.save(`attendance_monitor_${getLocalISOString(new Date())}.pdf`);
  };

  const groupedData = groupAttendanceByDate(data);
  const sortedDates = Object.keys(groupedData).sort((a, b) => b.localeCompare(a));

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto w-full p-4 lg:p-0">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Attendance Monitor</h2>
          <p className="text-slate-500 text-sm mt-1">Real-time tracking of employee presence and work hours</p>
        </div>
        <button
          onClick={downloadPDF}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 group"
        >
          <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11h6m-6 4h6" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {STATUS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${status === s
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
                }`}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-1 gap-3 min-w-[300px]">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search employee..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            />
            <svg className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 transition-all text-slate-600"
          />
        </div>
      </div>

      {/* Timeline View */}
      <div className="flex flex-col gap-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-indigo-600/20 border-t-indigo-600 rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium animate-pulse">Fetching records...</p>
          </div>
        ) : sortedDates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900">No records found</h3>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters or search query</p>
          </div>
        ) : (
          sortedDates.map((dateKey) => (
            <div key={dateKey} className="group/date relative">
              {/* Date Header (Sticky) */}
              <div
                onClick={() => toggleDate(dateKey)}
                className={`sticky top-0 z-10 flex items-center justify-between bg-white/80 backdrop-blur-md py-4 px-2 mb-4 border-b border-slate-100 cursor-pointer transition-all ${dateKey === getLocalISOString(new Date()) ? 'border-l-4 border-l-indigo-600 pl-4' : ''
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${dateKey === getLocalISOString(new Date()) ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-500'
                    }`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {formatDateHeader(dateKey)}
                      {dateKey === getLocalISOString(new Date()) && (
                        <span className="ml-2 text-[10px] bg-indigo-600 text-white px-2 py-0.5 rounded-full uppercase tracking-wider">Current</span>
                      )}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">{groupedData[dateKey].length} Employees Tracked</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex gap-2">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                      {groupedData[dateKey].filter(r => r.status === 'present').length} Present
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                      {groupedData[dateKey].filter(r => r.isLate).length} Late
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${expandedDates[dateKey] ? '' : '-rotate-90'}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* Attendance Card */}
              {expandedDates[dateKey] && (
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden transition-all duration-300">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50/50 text-slate-500">
                          <th className="p-4 text-left font-semibold uppercase tracking-wider text-[11px]">Employee</th>
                          <th className="p-4 text-center font-semibold uppercase tracking-wider text-[11px]">Punch In</th>
                          <th className="p-4 text-center font-semibold uppercase tracking-wider text-[11px]">Punch Out</th>
                          <th className="p-4 text-center font-semibold uppercase tracking-wider text-[11px]">Hours</th>
                          <th className="p-4 text-right font-semibold uppercase tracking-wider text-[11px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {groupedData[dateKey].map((item) => (
                          <tr key={item._id} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors group">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                                  {item.user?.name?.charAt(0) || '?'}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-900">{item.user?.name}</p>
                                  <p className="text-xs text-slate-400">{item.user?.email}</p>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center font-medium text-slate-600">
                              {item.punchIn ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                            </td>
                            <td className="p-4 text-center font-medium text-slate-600">
                              {item.punchOut ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "-"}
                            </td>
                            <td className="p-4 text-center">
                              <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs font-bold">
                                {calculateHours(item.punchIn, item.punchOut, item.workMinutes)}
                              </span>
                            </td>
                            <td className="p-4 text-right">
                              {(() => {
                                const s = (item.missedPunchOut ? "missed punch-out" : (item.status || "absent")).toLowerCase();
                                const isLate = item.isLate;
                                const styleMap = {
                                  absent: "bg-rose-50 text-rose-600",
                                  late: "bg-amber-50 text-amber-600",
                                  "late present": "bg-orange-50 text-orange-600",
                                  "half-day": "bg-blue-50 text-blue-600",
                                  "missed punch-out": "bg-orange-50 text-orange-600",
                                  present: "bg-emerald-50 text-emerald-600"
                                };
                                // If it's present but late, we can still use the late style or a combined one
                                let displayStyle = styleMap[s] || styleMap.present;
                                if (s === "present" && isLate) displayStyle = styleMap["late present"];

                                return (
                                  <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest ${displayStyle}`}>
                                    {s} {isLate && "(Late)"}
                                  </span>
                                );
                              })()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default AttendanceMonitor;