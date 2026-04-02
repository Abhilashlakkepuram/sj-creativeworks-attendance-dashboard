import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { getShiftSlots } from '../../utils/shiftUtils';

export default function DailyWorkReportForm() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);
    const [submissionSummary, setSubmissionSummary] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // We removed productivity and mood Rating per instructions.
    const [hoursData, setHoursData] = useState(() => {
        const slots = getShiftSlots();
        return slots.map(slot => ({
            slot,
            tasksCompleted: "",
            blockers: ""
        }));
    });

    const [overallNotes, setOverallNotes] = useState("");
    const [error, setError] = useState("");

    // Look for today's submission status.
    useEffect(() => {
        const checkReport = async () => {
            try {
                const res = await api.get('/reports/today');
                if (res.data) {
                    setAlreadySubmitted(true);
                    setSubmissionSummary(res.data);
                }
            } catch (err) {
                console.error("Failed to check report status", err);
            } finally {
                setLoading(false);
            }
        };
        checkReport();
    }, []);

    const handleHourChange = (index, field, value) => {
        setHoursData(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const validateForm = () => {
        for (const slot of hoursData) {
            if (!slot.tasksCompleted || slot.tasksCompleted.length < 10) {
                return `Tasks for slot ${slot.slot} must be at least 10 characters long.`;
            }
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");

        const validationError = validateForm();
        if (validationError) {
            setError(validationError);
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                hours: hoursData,
                overallNotes
            };
            const res = await api.post('/reports', payload);
            setSubmissionSummary(res.data);
            setAlreadySubmitted(true);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to submit report.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="flex justify-center py-20 text-slate-500 font-medium">Loading form...</div>;
    }

    if (alreadySubmitted && submissionSummary) {
        return (
            <div className="max-w-3xl mx-auto p-10 bg-white rounded-xl shadow-md border border-slate-100 text-center py-20">
                <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-8 ring-4 ring-emerald-50">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mb-3">Daily Report Submitted</h2>
                <p className="text-slate-500 font-medium mb-8">Thank you for submitting your daily end-of-day summary.</p>

                <div className="bg-slate-50 rounded-xl p-6 text-sm text-slate-700 font-medium text-left border border-slate-200 flex flex-col gap-3 shadow-inner">
                    <div className="flex justify-between items-center pb-3 border-b border-slate-200">
                        <span className="text-slate-500 uppercase text-xs tracking-wider font-bold">Submission Time</span>
                        <span>{new Date(submissionSummary.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2">
                        <span className="text-slate-500 uppercase text-xs tracking-wider font-bold">Status</span>
                        <span className="uppercase tracking-wider font-extrabold text-[10px] bg-slate-200 text-slate-700 px-3 py-1 rounded-full">{submissionSummary.status}</span>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/employee/dashboard')}
                    className="mt-10 px-8 py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow hover:shadow-lg"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto w-full pb-20 px-4 xl:px-0">
            <div className="mb-10 text-center sm:text-left">
                <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">Daily Work Report</h2>
                <p className="text-slate-500 mt-2 font-medium">Log your daily progress and summarize completed deliverables</p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-8">

                <div className="flex flex-col gap-6">
                    {hoursData.map((slotData, index) => {
                        const isLunchDivider = index === 3; // Render before Slot 4

                        return (
                            <div key={slotData.slot}>
                                {isLunchDivider && (
                                    <div className="flex items-center gap-6 py-6 opacity-60 px-4">
                                        <hr className="flex-1 border-t border-slate-300" />
                                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-white ring-1 ring-slate-200 px-5 py-2 rounded-full">
                                            Lunch Break — 13:00 to 14:00
                                        </span>
                                        <hr className="flex-1 border-t border-slate-300" />
                                    </div>
                                )}
                                <div className="bg-white p-6 sm:p-8 rounded-xl shadow-sm border border-slate-200 hover:border-indigo-100 hover:shadow-md transition-all flex flex-col md:flex-row gap-8">
                                    {/* Timing Block */}
                                    <div className="md:w-1/4 shrink-0 flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 pb-4 md:pb-0 md:pr-6">
                                        <div className="text-xs font-extrabold text-slate-400 tracking-widest uppercase mb-1">Time Slot</div>
                                        <span className="text-sm font-bold text-indigo-700 bg-indigo-50/50 block text-center px-4 py-2 rounded-lg border border-indigo-100 tracking-wide">
                                            {slotData.slot}
                                        </span>
                                    </div>

                                    {/* Data Block */}
                                    <div className="flex-1 flex flex-col gap-6">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Key Deliverables / Tasks Completed *</label>
                                            <textarea
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all min-h-[90px]"
                                                placeholder="Please specify tasks completed during this block..."
                                                value={slotData.tasksCompleted}
                                                onChange={(e) => handleHourChange(index, "tasksCompleted", e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Impediments / Blockers (Optional)</label>
                                            <input
                                                type="text"
                                                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-4 text-sm font-medium text-slate-700 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:bg-white focus:outline-none transition-all"
                                                placeholder="Any encountered issues limiting progress?"
                                                value={slotData.blockers}
                                                onChange={(e) => handleHourChange(index, "blockers", e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="my-2 border-t border-slate-200"></div>

                {/* OVERALL */}
                <div className="bg-slate-900 p-8 rounded-xl shadow border border-slate-800 text-white">
                    <label className="block text-sm font-extrabold text-white mb-2 tracking-wide uppercase">End-of-Day Summary</label>
                    <p className="text-slate-400 text-xs mb-4">Please provide an optional high-level overview or any handover notes</p>
                    <textarea
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-4 text-sm font-medium text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:bg-slate-800 focus:outline-none transition-all min-h-[120px]"
                        placeholder="Operations overview..."
                        value={overallNotes}
                        onChange={(e) => setOverallNotes(e.target.value)}
                        maxLength={500}
                    />
                    <p className="text-right text-xs text-slate-500 font-bold mt-2">{overallNotes.length}/500</p>
                </div>

                {error && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-200 p-4 rounded-lg text-sm font-bold flex items-center gap-3">
                        <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-4 text-lg font-extrabold uppercase tracking-widest rounded-lg transition-all shadow hover:shadow-lg disabled:shadow-none bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-400 disabled:cursor-not-allowed mt-2"
                >
                    {submitting ? "Submitting Report..." : "Submit Daily Work Report"}
                </button>
            </form>
        </div>
    );
}
