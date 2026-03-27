function Reports() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Reports</h2>
        <p className="mt-1 text-slate-500">Generate and view attendance reports</p>
      </div>
      <div className="bg-white p-12 rounded-xl shadow border border-slate-100 flex flex-col items-center justify-center text-center">
        <svg className="w-16 h-16 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-semibold text-slate-800">Coming Soon</h3>
        <p className="text-slate-500 max-w-sm mt-2">The reports module is currently being developed.</p>
      </div>
    </div>
  );
}

export default Reports;
