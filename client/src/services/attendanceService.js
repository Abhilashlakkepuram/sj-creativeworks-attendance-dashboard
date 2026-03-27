import api from "./api";

const attendanceService = {
  // 🟢 Punch In
  punchIn: async (location) => {
    const res = await api.post("/attendance/punch-in", { location });
    return res.data;
  },

  // 🔴 Punch Out
  punchOut: async (location) => {
    const res = await api.post("/attendance/punch-out", { location });
    return res.data;
  },

  // 🏥 Get Today's Status
  getTodayStatus: async () => {
    const res = await api.get("/attendance/today-status");
    return res.data;
  },

  // 📊 Get My Attendance History
  getMyAttendance: async () => {
    const res = await api.get("/attendance/my-attendance");
    return res.data;
  },

  // 📑 Get All Attendance (Admin)
  getAllAttendance: async (params) => {
    const res = await api.get("/admin/attendance", { params });
    return res.data;
  }
};

export default attendanceService;
