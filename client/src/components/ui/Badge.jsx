import React from 'react';

const Badge = ({ children, status, className = '' }) => {
  let colorClass = 'bg-slate-100 text-slate-800 border-slate-200';

  if (status === 'pending') colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (status === 'approved' || status === 'success') colorClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (status === 'rejected' || status === 'error') colorClass = 'bg-rose-100 text-rose-800 border-rose-200';

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${colorClass} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
