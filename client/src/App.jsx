import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import SocketProvider from "./socket/SocketProvider";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";

// Layouts
import AdminLayout from "./layouts/AdminLayout";
import EmployeeLayout from "./layouts/EmployeeLayout";

// Admin pages
import AdminDashboard from "./pages/admin/Dashboard";
import Employees from "./pages/admin/Employees";
import LeaveRequests from "./pages/admin/LeaveRequests";
import AttendanceMonitor from "./pages/admin/AttendanceMonitor";
import AdminHolidays from "./pages/admin/Holidays";
import Reports from "./pages/admin/Reports";
import EmployeeProfile from "./pages/admin/EmployeeProfile";
import EmployeeAttendance from "./pages/admin/EmployeeAttendance";
import PostAnnouncement from "./pages/admin/PostAnnouncement";
import DailyReports from "./pages/admin/DailyReports";

// Employee pages
import EmployeeDashboard from "./pages/employee/Dashboard";
import Attendance from "./pages/employee/Attendance";
import Leaves from "./pages/employee/Leaves";
import EmployeeHolidays from "./pages/employee/Holidays";
import Chat from "./pages/employee/Chat";
import Notifications from "./pages/Notifications";
import DailyReport from "./pages/employee/DailyReport";


// 🔐 Role Protection
function RequireRole({ roleNeeded, children }) {
  const { token, role } = useAuth();

  if (!token) return <Navigate to="/" replace />;

  if (roleNeeded === "admin" && role !== "admin") {
    return <Navigate to="/employee/dashboard" replace />;
  }

  if (roleNeeded === "employee" && role === "admin") {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return children;
}


// 🚀 Routes
function AppRoutes() {
  return (
    <Routes>

      {/* Public */}
      <Route path="/" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <RequireRole roleNeeded="admin">
            <AdminLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employee/:id" element={<EmployeeProfile />} />
        <Route path="employee/attendance/:id" element={<EmployeeAttendance />} />
        <Route path="leaves" element={<LeaveRequests />} />
        <Route path="attendance" element={<AttendanceMonitor />} />
        <Route path="holidays" element={<AdminHolidays />} />
        <Route path="reports" element={<Reports />} />
        <Route path="daily-reports" element={<DailyReports />} />
        <Route path="chat" element={<Chat />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="announcements" element={<PostAnnouncement />} />
      </Route>

      {/* Employee */}
      <Route
        path="/employee"
        element={
          <RequireRole roleNeeded="employee">
            <EmployeeLayout />
          </RequireRole>
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<EmployeeDashboard />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="leaves" element={<Leaves />} />
        <Route path="holidays" element={<EmployeeHolidays />} />
        <Route path="chat" element={<Chat />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="daily-report" element={<DailyReport />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />

    </Routes>
  );
}


// 🔥 Root App
function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;