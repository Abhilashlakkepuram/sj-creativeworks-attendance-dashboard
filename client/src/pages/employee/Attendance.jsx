import { useState, useEffect } from "react";
import api from "../../config/axiosConfig";
import Card, { CardHeader, CardTitle } from "../../components/ui/Card";
import Badge from "../../components/ui/Badge";

function Attendance() {
  const [attendance, setAttendance] = useState([]);

  const fetchAttendance = async () => {
    try {
      const res = await api.get("/attendance/my-attendance");
      setAttendance(res.data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Attendance History
          </h2>
          <p className="mt-1 text-slate-500">
            View your past attendance records
          </p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-700">Date</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Punch In</th>
                <th className="px-6 py-4 font-semibold text-slate-700">Punch Out</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-right">Work Hours</th>
                <th className="px-6 py-4 font-semibold text-slate-700 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendance.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No attendance records found.
                  </td>
                </tr>
              ) : (
                attendance.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {new Date(item.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.punchIn
                        ? new Date(item.punchIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "-"
                      }
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {item.punchOut
                        ? new Date(item.punchOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : "-"
                      }
                    </td>
                    <td className="px-6 py-4 text-slate-600 text-right font-mono">
                      {item.workMinutes !== undefined
                        ? `${Math.floor(item.workMinutes / 60)}h ${item.workMinutes % 60}m`
                        : item.workHours
                          ? `${item.workHours}h`
                          : "-"}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Badge status={item.status}>{item.status || "present"}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default Attendance;
