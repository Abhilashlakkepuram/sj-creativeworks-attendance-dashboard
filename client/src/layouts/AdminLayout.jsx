import { Outlet } from "react-router-dom";
import { useState } from "react";
import AdminSidebar from "../components/admin/AdminSidebar";
import AdminNavbar from "../components/admin/AdminNavbar";

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {sidebarOpen && <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-w-0">
        <AdminNavbar onOpen={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
};

export default AdminLayout;
