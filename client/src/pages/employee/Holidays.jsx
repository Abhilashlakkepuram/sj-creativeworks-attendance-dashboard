import { useState, useEffect, useContext } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import Badge from "../../components/ui/Badge";

function Holidays() {
  const socket = useContext(SocketContext);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchHolidays = async () => {
    try {
      setLoading(true);
      const res = await api.get("/holidays");
      setHolidays(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHolidays();

    if (socket) {
      socket.on("holiday-update", fetchHolidays);
      return () => socket.off("holiday-update", fetchHolidays);
    }
  }, [socket]);

  const getBadgeStatus = (type) => {
    switch (type) {
      case "company": return "success";
      case "optional": return "pending";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between relative overflow-hidden group">
        <div className="relative z-10">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase leading-none">Company Holidays</h2>
          <p className="mt-3 text-slate-500 font-medium max-w-md leading-relaxed">
            Plan your time off with our official holiday schedule for the current calendar year.
          </p>
        </div>
        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-700">
           <svg className="w-48 h-48 text-slate-900" fill="currentColor" viewBox="0 0 24 24">
             <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z"/>
           </svg>
        </div>
      </div>

      {/* Listing Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Date</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Day</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Holiday Name</th>
                <th className="px-8 py-5 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-400 animate-pulse font-bold uppercase tracking-widest">Refreshing Calendar...</td>
                </tr>
              ) : holidays.length === 0 ? (
                <tr>
                  <td colSpan="4" className="px-8 py-20 text-center text-slate-500 font-bold bg-slate-50/20">No holidays found for this year.</td>
                </tr>
              ) : (
                holidays.map((h) => {
                  const dateObj = new Date(h.date);
                  return (
                    <tr key={h._id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-black text-lg tracking-tight">
                            {dateObj.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                            {dateObj.getFullYear()}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-slate-600 text-sm font-black uppercase tracking-wider">
                          {dateObj.toLocaleDateString("en-IN", { weekday: 'long' })}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <span className="text-slate-800 font-bold text-base group-hover:text-primary-600 transition-colors capitalize">
                          {h.title}
                        </span>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <Badge status={getBadgeStatus(h.type)}>
                          {h.type}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default Holidays;
