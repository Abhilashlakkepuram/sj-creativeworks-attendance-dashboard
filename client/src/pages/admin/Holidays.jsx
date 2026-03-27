import { useState, useEffect, useContext } from "react";
import api from "../../services/api";
import { SocketContext } from "../../socket/SocketContext";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Badge from "../../components/ui/Badge";
import Card, { CardContent, CardHeader, CardTitle } from "../../components/ui/Card";

function Holidays() {
  const socket = useContext(SocketContext);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    type: "public"
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post("/holidays", form);
      setForm({ title: "", date: "", type: "public" });
      fetchHolidays();
      alert("Holiday added successfully!");
    } catch (err) {
      alert("Failed to add holiday");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this holiday?")) return;
    try {
      await api.delete(`/holidays/${id}`);
      fetchHolidays();
    } catch (err) {
      alert("Failed to delete holiday");
    }
  };

  const getBadgeStatus = (type) => {
    switch (type) {
      case "company": return "success";
      case "optional": return "pending";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight uppercase">Holiday Management</h2>
        <p className="text-slate-500 text-sm mt-1">Add and manage upcoming company holidays.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Card */}
        <div className="lg:col-span-4">
          <Card className="rounded-3xl border-slate-100 shadow-sm sticky top-24">
            <CardHeader className="border-b border-slate-50">
              <CardTitle className="text-sm font-black uppercase text-slate-400 tracking-widest">New Holiday</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-5">
                <Input
                  label="Holiday Name"
                  required
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Independence Day"
                />
                <Input
                  label="Date"
                  required
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
                <div className="space-y-1.5 w-full">
                  <label className="text-sm font-medium text-slate-700">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 capitalize transition-colors"
                  >
                    <option value="public">Public Holiday</option>
                    <option value="optional">Optional Holiday</option>
                    <option value="company">Company Holiday</option>
                  </select>
                </div>
                <Button type="submit" className="w-full py-3 rounded-xl font-bold uppercase tracking-widest">
                  Add Holiday
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* List Section */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest pl-1">Upcoming Holidays</h3>
          {loading && holidays.length === 0 ? (
            <div className="p-20 text-center text-slate-400 italic">Fetching calendar...</div>
          ) : holidays.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-slate-100 rounded-3xl p-16 text-center">
              <p className="text-slate-400 font-bold">No holidays listed yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {holidays.map(h => (
                <div key={h._id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <Badge status={getBadgeStatus(h.type)}>
                      {h.type}
                    </Badge>
                    <button
                      onClick={() => handleDelete(h._id)}
                      className="text-slate-300 hover:text-rose-500 transition-colors p-1"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 tracking-tight leading-tight uppercase group-hover:text-primary-600 transition-colors">
                    {h.title}
                  </h4>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      <svg className="w-4 h-4 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs font-black uppercase tracking-widest">
                        {new Date(h.date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-slate-300 tracking-tighter">
                      {new Date(h.date).toLocaleDateString("en-IN", { weekday: 'long' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Holidays;
