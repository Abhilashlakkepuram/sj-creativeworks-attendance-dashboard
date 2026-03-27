import { useState } from "react";
import api from "../../config/axiosConfig";

function Leaves() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split("T")[0];

  const submitLeave = async (e) => {
    e.preventDefault();

    // Final validation check before submission (MNC standard)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (start < now) {
      alert("Leave start date cannot be in the past.");
      return;
    }

    if (end < start) {
      alert("Leave end date cannot be before the start date.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/leaves/request", {
        startDate,
        endDate,
        reason
      });

      alert(res.data.message);
      setStartDate("");
      setEndDate("");
      setReason("");
    } catch (error) {
      alert(error.response?.data?.message || "Error submitting leave");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-slate-800">Request Leave</h2>

      <div className="bg-white p-6 rounded-xl shadow border border-slate-100">
        <form onSubmit={submitLeave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={startDate}
                min={today}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  // If end date is before new start date, reset it
                  if (endDate && e.target.value > endDate) {
                    setEndDate("");
                  }
                }}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                value={endDate}
                min={startDate || today}
                onChange={(e) => setEndDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Reason for Leave
            </label>
            <textarea
              className="w-full border border-slate-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 h-32 resize-none"
              placeholder="Please describe the reason for your leave request..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-medium px-6 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Submitting..." : "Submit Leave Request"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Leaves;
