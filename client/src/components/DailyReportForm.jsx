import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import {
  getShiftSlots,
  isSubmissionAllowed,
  getTimeUntilUnlock,
  isTodaySubmitted,
  moodEmoji,
} from "../utils/shiftUtils";

const SLOTS = getShiftSlots();

// ── Submitted card ──────────────────────────────────────────────────────────
function SubmittedCard({ report }) {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center mb-6">
        <div className="text-5xl mb-3">✅</div>
        <h2 className="text-2xl font-black text-emerald-800">Daily Report Submitted!</h2>
        <p className="text-emerald-600 mt-1 text-sm">
          Submitted at{" "}
          {new Date(report.submittedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {" · "}
          Mood: {moodEmoji(report.moodRating)}
        </p>
        
        {report.isLeave && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
            🌴 On Leave
          </div>
        )}

        <span
          className={`mt-3 inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            report.status === "approved"
              ? "bg-emerald-100 text-emerald-700"
              : report.status === "flagged"
              ? "bg-red-100 text-red-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {report.status}
        </span>

        {report.adminNote && (
          <div className="mt-4 text-left bg-white border border-slate-200 rounded-xl p-4 text-sm text-slate-600">
            <span className="font-bold text-slate-700">Admin note: </span>
            {report.adminNote}
          </div>
        )}
      </div>

      {/* Hour slots summary */}
      {!report.isLeave && report.hours && report.hours.length > 0 && (
        <div className="flex flex-col gap-3">
          {report.hours.map((h, i) => (
            <div key={i}>
              {i === 3 && (
                <div className="my-2 flex items-center gap-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <div className="flex-1 h-px bg-slate-200" />
                  🍽 Lunch Break 1:00 – 2:00 PM
                  <div className="flex-1 h-px bg-slate-200" />
                </div>
              )}
              <div className="bg-white border border-slate-100 rounded-xl p-4 flex gap-4 items-start">
                <div className="min-w-[110px] text-xs font-black text-teal-700 bg-teal-50 border border-teal-100 rounded-lg px-2 py-1 text-center">
                  {h.slot}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-700">{h.tasksCompleted || "No tasks reported."}</p>
                  {h.blockers && <p className="mt-1 text-xs text-red-500">⚠ {h.blockers}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {report.overallNotes && (
        <div className="mt-4 bg-white border border-slate-100 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Overall Notes</p>
          <p className="text-sm text-slate-700">{report.overallNotes}</p>
        </div>
      )}
    </div>
  );
}

// ── Main form ───────────────────────────────────────────────────────────────
export default function DailyReportForm() {
  const [todayReport, setTodayReport] = useState(undefined); // undefined = loading
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [hours, setHours] = useState(
    SLOTS.map((slot) => ({ slot, tasksCompleted: "", blockers: "" }))
  );
  const [overallNotes, setOverallNotes] = useState("");
  const [moodRating, setMoodRating] = useState(0);
  const [isLeave, setIsLeave] = useState(false);

  // Fetch today's report on mount
  useEffect(() => {
    api.get("/reports/today")
      .then((res) => setTodayReport(res.data))
      .catch(() => setTodayReport(null));
  }, []);

  const updateSlot = useCallback((index, field, value) => {
    setHours((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (moodRating < 1) {
      setError("Please select a mood rating.");
      return;
    }

    // Filter out empty hours if not on leave
    const hoursToSubmit = isLeave ? [] : hours.filter(h => h.tasksCompleted.trim().length > 0 || h.blockers.trim().length > 0);

    setSubmitting(true);
    try {
      const res = await api.post("/reports", { 
        hours: hoursToSubmit, 
        overallNotes, 
        moodRating,
        isLeave 
      });
      setTodayReport(res.data.report);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (todayReport === undefined) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm animate-pulse">
        Loading daily report…
      </div>
    );
  }

  // ── Already submitted ──────────────────────────────────────────────────────
  if (isTodaySubmitted(todayReport)) {
    return <SubmittedCard report={todayReport} />;
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 pb-10">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Daily Report</h2>
          <p className="text-sm text-slate-500 font-medium">Shift: 10:00 AM – 7:00 PM &nbsp;|&nbsp; Lunch: 1:00–2:00 PM</p>
        </div>

        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold">
          🔓 Submission open
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        
        {/* Leave Status */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-700">Are you taking off today?</span>
            <span className="text-xs text-slate-400">Mark as leave if you are not working or leaving early</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={isLeave}
              onChange={(e) => setIsLeave(e.target.checked)}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-teal-600"></div>
          </label>
        </div>

        {/* Hour slots */}
        {!isLeave && (
          <div className="flex flex-col gap-3">
            {SLOTS.map((slot, i) => (
              <div key={slot}>
                {/* Lunch divider between slot index 2 and 3 */}
                {i === 3 && (
                  <div className="my-3 flex items-center gap-3 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <div className="flex-1 h-px bg-slate-200" />
                    🍽 Lunch Break &nbsp;1:00 – 2:00 PM
                    <div className="flex-1 h-px bg-slate-200" />
                  </div>
                )}

                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col gap-3">
                  {/* Slot label */}
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-600 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-lg">
                      {slot}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Hour {i + 1}</span>
                  </div>

                  {/* Tasks */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      What did you complete?
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Describe tasks completed this hour…"
                      value={hours[i].tasksCompleted}
                      onChange={(e) => updateSlot(i, "tasksCompleted", e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition placeholder-slate-300"
                    />
                  </div>

                  {/* Blockers */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                      Any blockers?
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Waiting on design files…"
                      value={hours[i].blockers}
                      onChange={(e) => updateSlot(i, "blockers", e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-400 transition placeholder-slate-300"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Overall notes */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            Overall notes for the day
            <span className="text-slate-400 font-normal ml-1">(optional, max 500 chars)</span>
          </label>
          <textarea
            rows={3}
            maxLength={500}
            placeholder="Any general notes, wins, or concerns for today…"
            value={overallNotes}
            onChange={(e) => setOverallNotes(e.target.value)}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400 transition placeholder-slate-300"
          />
          <span className="text-xs text-slate-400 self-end">{overallNotes.length}/500</span>
        </div>

        {/* Mood */}
        <div className="bg-white border border-slate-100 rounded-2xl shadow-sm p-5 flex flex-col gap-2">
          <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">
            How are you feeling today? <span className="text-red-400">*</span>
          </label>
          <div className="flex gap-3">
            {[1, 2, 3, 4, 5].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMoodRating(m)}
                className={`text-3xl transition-transform hover:scale-110 rounded-xl p-2 ${
                  moodRating === m
                    ? "bg-amber-50 ring-2 ring-amber-400 scale-110"
                    : "opacity-50 hover:opacity-100"
                }`}
              >
                {moodEmoji(m)}
              </button>
            ))}
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting}
          className={`w-full py-4 rounded-2xl text-sm font-black uppercase tracking-wider transition ${
            !submitting
              ? "bg-teal-600 hover:bg-teal-700 text-white shadow-lg hover:shadow-xl"
              : "bg-slate-200 text-slate-400 cursor-not-allowed"
          }`}
        >
          {submitting ? "Submitting…" : "Submit Daily Report"}
        </button>
      </form>
    </div>
  );
}
