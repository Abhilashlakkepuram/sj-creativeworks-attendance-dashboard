import React from 'react';

const Input = ({ label, className = '', ...props }) => {
  return (
    <div className="flex flex-col space-y-1.5 w-full">
      {label && <label className="text-sm font-medium text-slate-700">{label}</label>}
      <input
        className={`px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-slate-900 placeholder-slate-400 disabled:opacity-50 transition-colors ${className}`}
        {...props}
      />
    </div>
  );
};

export default Input;
