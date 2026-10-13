import { Outlet } from "react-router-dom";
import { useState } from "react";
import EmployeeSidebar from "../components/employee/EmployeeSidebar";
import EmployeeNavbar from "../components/employee/EmployeeNavbar";

const EmployeeLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-slate-50">

      {sidebarOpen && <button type="button" aria-label="Close menu" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden" />}
      <EmployeeSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col ml-0 lg:ml-64 min-h-screen min-w-0">

        <EmployeeNavbar onOpen={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
};

export default EmployeeLayout;
