import React from "react";

const DeleteConfirmationModal = ({ isOpen, onClose, onConfirm, employeeName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="flex items-start gap-4">
            {/* Warning Icon */}
            <div className="flex-shrink-0 w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div className="flex-1">
              <h3 className="text-xl font-bold text-slate-900 leading-6">
                Delete Employee
              </h3>
              <div className="mt-3">
                <p className="text-sm text-slate-500 leading-relaxed">
                  Are you sure you want to delete <span className="font-semibold text-slate-700">{employeeName || "this employee"}</span>? 
                  All of their data will be permanently removed. This action cannot be undone.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="px-6 py-4 bg-slate-50 flex flex-col-reverse sm:flex-row justify-end gap-3 mt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-rose-600 text-sm font-bold text-white hover:bg-rose-700 shadow-lg shadow-rose-100 transition-all duration-200"
          >
            Delete Employee
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmationModal;
