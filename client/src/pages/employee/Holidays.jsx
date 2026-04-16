import { useState, useEffect, useContext } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { isSaturday, isSunday, getDay, isSameDay } from "date-fns";

import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import Badge from "../../components/ui/Badge";

function Holidays() {
  const socket = useContext(SocketContext);

  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedDate, setSelectedDate] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ Fetch Holidays
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

  // ✅ Calendar Styling Logic
  const getTileClass = ({ date }) => {
    const isHoliday = holidays.some((h) =>
      isSameDay(new Date(h.date), date)
    );

    // Weekends marking logic
    if (isSunday(date)) {
      return "custom-sunday border-red-200 border bg-red-50 text-red-600";
    }

    if (isSaturday(date)) {
      const week = Math.ceil(date.getDate() / 7);
      if (week === 2 || week === 4) {
        return "custom-saturday border-amber-200 border bg-amber-50 text-amber-600";
      }
    }

    // Company Holiday
    if (isHoliday) {
      return "custom-holiday border-emerald-200 border bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100";
    }

    return "text-slate-700 hover:text-primary-600";
  };

  // ✅ Click Date
  const handleDateClick = (date) => {
    const isHoliday = holidays.some((h) => isSameDay(new Date(h.date), date));

    // Disable clicks on existing holidays or sundays or past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isHoliday || isSunday(date) || date < today) return;

    setSelectedDate(date);
    setShowModal(true);
  };

  // ✅ Submit Leave
  const submitLeave = async () => {
    if (!reason.trim()) {
      alert("Please enter a reason for your leave.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/leaves/request", {
        startDate: selectedDate,
        endDate: selectedDate,
        reason,
      });

      alert("Leave requested successfully! Your manager will review it shortly.");
      setShowModal(false);
      setReason("");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.message || "Error submitting leave");
    } finally {
      setSubmitting(false);
    }
  };

  const getBadgeStatus = (type) => {
    switch (type) {
      case "company":
        return "success";
      case "optional":
        return "pending";
      default:
        return "default";
    }
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-12">

      {/* 🚀 INJECTED CUSTOM CSS FOR REACT-CALENDAR TO MAKE IT BEAUTIFUL */}
      <style dangerouslySetInnerHTML={{
        __html: `
        .react-calendar {
          width: 100% !important;
          border: none !important;
          font-family: inherit !important;
          background: transparent !important;
        }
        .react-calendar__navigation {
          margin-bottom: 2rem;
        }
        .react-calendar__navigation button {
          min-width: 36px;
          height: 36px;
          background: white;
          border-radius: 10px;
          margin: 0 2px;
          font-weight: 800;
          font-size: 1rem;
          color: #1e293b;
          transition: all 0.2s;
        }
        .react-calendar__navigation button:hover:not(:disabled) {
          background: #f1f5f9 !important;
        }
        .react-calendar__navigation button:disabled {
          opacity: 0.5;
        }
        .react-calendar__month-view__weekdays {
          text-transform: uppercase;
          font-weight: 900;
          font-size: 0.75rem;
          color: #94a3b8;
          padding-bottom: 1rem;
        }
        .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none;
        }
        .react-calendar__month-view__days {
          gap: 6px;
          display: grid !important;
          grid-template-columns: repeat(7, 1fr);
        }
        .react-calendar__tile {
          flex: none !important;
          width: 100% !important;
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 16px !important;
          font-weight: 700 !important;
          font-size: 1rem !important;
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
          position: relative;
          overflow: hidden;
        }
        .react-calendar__month-view__days__day--neighboringMonth {
          color: #cbd5e1 !important;
          background: transparent !important;
          border-color: transparent !important;
          box-shadow: none !important;
          pointer-events: none;
        }
        .react-calendar__tile:enabled:hover,
        .react-calendar__tile:enabled:focus {
          background-color: #e0e7ff !important;
          color: #4f46e5 !important;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px -2px rgba(79, 70, 229, 0.15) !important;
        }
        .react-calendar__tile--now {
          background: #f8fafc !important;
          color: #0f172a !important;
        }
        .react-calendar__tile--now::after {
          content: '';
          position: absolute;
          bottom: 8px;
          width: 6px;
          height: 6px;
          background-color: #4f46e5;
          border-radius: 50%;
        }
        .react-calendar__tile--active,
        .react-calendar__tile--active:enabled:hover,
        .react-calendar__tile--active:enabled:focus {
          background: #4f46e5 !important;
          color: white !important;
          box-shadow: 0 10px 15px -3px rgba(79, 70, 229, 0.4) !important;
          border-color: transparent !important;
        }
        abbr[title] {
          text-decoration: none !important;
          cursor: text;
        }
      `}} />

      {/* ───────────────── HEADER ───────────────── */}
      <div className="relative overflow-hidden bg-white p-5 md:p-7 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group">
        <div className="relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-primary-50 rounded-xl">
              <svg className="w-5 h-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">
              Company Calendar
            </h2>
          </div>
          <p className="text-slate-400 font-medium max-w-lg leading-relaxed text-sm">
            Official holiday schedule. Click any available working day to request leave.
          </p>
        </div>

        {/* Decorative Background */}
        <div className="absolute -right-10 -bottom-10 opacity-[0.03] group-hover:scale-110 transition-transform duration-700 pointer-events-none">
          <svg className="w-64 h-64 text-primary-900" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM9 14H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2zm-8 4H7v-2h2v2zm4 0h-2v-2h2v2zm4 0h-2v-2h2v2z" />
          </svg>
        </div>
      </div>

      {/* ───────────────── MAIN GRID ───────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* 📅 CALENDAR (LEFT COLUMN) */}
        <div className="lg:col-span-7 xl:col-span-6 flex flex-col gap-4">
          {/* Map Legend */}
          <div className="flex flex-wrap gap-4 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Sunday</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">2nd & 4th Saturday</span>
            </div>
          </div>
          <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm">
            <Calendar
              onClickDay={handleDateClick}
              tileClassName={getTileClass}
              minDetail="year"
              next2Label={null}
              prev2Label={null}
            />
          </div>



        </div>

        {/* 📋 HOLIDAY SIDE PANEL (RIGHT COLUMN) */}
        <div className="lg:col-span-5 xl:col-span-6 flex flex-col gap-6 mt-10">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col h-[550px] lg:sticky lg:top-8">

            <div className="p-6 border-b border-slate-50 bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </span>
                Upcoming Holidays
              </h3>
            </div>

            <div className="p-6 flex-1 overflow-y-auto scrollbar-hide space-y-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                  <span className="w-8 h-8 border-4 border-slate-100 border-t-primary-500 rounded-full animate-spin" />
                  <span className="text-xs font-bold uppercase tracking-widest">Loading Calendar...</span>
                </div>
              ) : holidays.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 opacity-50">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="font-bold">No holidays recorded yet</p>
                </div>
              ) : (
                holidays.map((h, index) => {
                  const dateObj = new Date(h.date);
                  return (
                    <div
                      key={h._id}
                      className="group relative p-5 bg-white border border-slate-100 rounded-2xl shadow-sm hover:shadow-md hover:border-primary-100 transition-all duration-300"
                    >
                      {/* Timeline Dot Connector (visual flair) */}
                      {index !== holidays.length - 1 && (
                        <div className="absolute top-full left-8 w-[2px] h-4 bg-slate-100 group-hover:bg-primary-50 transition-colors" />
                      )}

                      <div className="flex justify-between items-start mb-3">
                        <div className="flex flex-col">
                          <span className="text-xl font-black text-slate-800 tracking-tight group-hover:text-primary-600 transition-colors">
                            {dateObj.toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {dateObj.toLocaleDateString("en-IN", { weekday: 'long' })}
                          </span>
                        </div>
                        <Badge status={getBadgeStatus(h.type)}>
                          {h.type}
                        </Badge>
                      </div>

                      <h4 className="text-base font-bold text-slate-700 capitalize break-words">
                        {h.title}
                      </h4>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────── GLASSMORPHISM MODAL ───────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 transform transition-all scale-100 animate-in zoom-in-95 duration-200">
            <div className="absolute top-4 right-4">
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-800 tracking-tight">Request Leave</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                  For {selectedDate?.toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 pl-1">
                  Reason for Absence
                </label>
                <textarea
                  placeholder="State your reason clearly..."
                  className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-3 text-sm focus:ring-4 focus:ring-primary-50 focus:border-primary-400 outline-none transition-all resize-none h-32 leading-relaxed text-slate-700"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  className="flex-1 px-4 py-3 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl shadow-lg shadow-primary-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  onClick={submitLeave}
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Holidays;