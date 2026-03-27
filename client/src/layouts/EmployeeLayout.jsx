import { Outlet } from "react-router-dom";
import EmployeeSidebar from "../components/employee/EmployeeSidebar";
import EmployeeNavbar from "../components/employee/EmployeeNavbar";

const EmployeeLayout = () => {
  return (
    <div className="flex min-h-screen bg-slate-50">

      <EmployeeSidebar />

      <div className="flex-1 flex flex-col ml-64 min-h-screen">

        <EmployeeNavbar />

        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>

      </div>

    </div>
  );
};

export default EmployeeLayout;