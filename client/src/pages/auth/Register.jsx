import { useState, useMemo } from "react";
import api from "../../config/axiosConfig";
import { useNavigate, Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import logo from "../../assets/sj-logo.png";

// ── Password Strength Helper ──────────────────────────────────────────
const getPasswordStrength = (password) => {
    const checks = {
        length: password.length >= 8,
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*]/.test(password),
        upper: /[A-Z]/.test(password),
    };
    const score = Object.values(checks).filter(Boolean).length;
    return { checks, score };
};

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["", "bg-red-500", "bg-orange-400", "bg-yellow-400", "bg-emerald-500"];
const strengthTextColors = ["", "text-red-500", "text-orange-400", "text-yellow-500", "text-emerald-600"];

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: ""
    });

    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [notification, setNotification] = useState(null);

    const { checks, score } = useMemo(() => getPasswordStrength(formData.password), [formData.password]);
    const passwordsMatch = formData.confirmPassword && formData.password === formData.confirmPassword;

    const showNotification = (msg, type = "success") => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (formData.password !== formData.confirmPassword) {
            setErrorMsg("Passwords do not match");
            return;
        }

        // Enforce strong password on frontend too
        const strongRegex = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/;
        if (!strongRegex.test(formData.password)) {
            setErrorMsg("Password must be at least 8 characters and include an uppercase letter, a number, and a special character (!@#$%^&*)");
            return;
        }

        setLoading(true);
        setErrorMsg("");

        try {
            const res = await api.post("/auth/register", formData);
            showNotification(res.data.message || "Registration successful! Wait for admin approval.");
            setTimeout(() => navigate("/"), 2000);
        } catch (error) {
            setErrorMsg(error.response?.data?.message || "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col lg:flex-row bg-slate-50 relative overflow-hidden">

            {/* ── MOBILE HEADER STRIP (hidden on lg+) ───────────────────── */}
            <div className="lg:hidden relative bg-primary-900 text-white px-6 pt-10 pb-8 overflow-hidden flex-shrink-0">
                {/* Subtle blobs */}
                <div className="absolute -top-10 -left-10 w-48 h-48 bg-primary-600 rounded-full mix-blend-multiply filter blur-2xl opacity-60 animate-blob" />
                <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-secondary-500 rounded-full mix-blend-multiply filter blur-2xl opacity-60 animate-blob animation-delay-2000" />

                <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20 p-1.5 flex-shrink-0">
                        <img src={logo} alt="SJ Logo" className="w-full h-full object-contain" />
                    </div>
                    <div>
                        <h1 className="text-lg font-extrabold tracking-tight leading-tight">SJ Creativeworks</h1>
                        <p className="text-xs text-primary-200 mt-0.5">Join our team — apply below</p>
                    </div>
                </div>
            </div>

            {/* ── DESKTOP LEFT PANEL (hidden below lg) ──────────────────── */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-primary-900 overflow-hidden text-white flex-col justify-center items-center p-12 flex-shrink-0">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
                <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-secondary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
                <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000" />

                <div className="relative z-10 text-center w-full max-w-lg">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-xl shadow-primary-500/20 p-2 overflow-hidden">
                        <img src={logo} alt="SJ Creativeworks Logo" className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight mb-6">SJ Creativeworks</h1>
                    <p className="text-lg text-primary-100 mb-10 leading-relaxed">
                        Join our team of developers, designers, and creatives. Streamline your workflow and track your daily progress with our intelligent attendance platform.
                    </p>
                    <div className="relative w-full h-48 mt-8">
                        <div className="absolute top-0 left-10 w-24 h-24 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 animate-[bounce_4s_infinite] shadow-2xl flex items-center justify-center">
                            <svg className="w-10 h-10 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        </div>
                        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 backdrop-blur-md rounded-full border border-white/20 animate-[bounce_5s_infinite_1s] shadow-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        </div>
                        <div className="absolute bottom-0 left-1/3 w-28 h-28 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 animate-[bounce_6s_infinite_0.5s] shadow-2xl flex items-center justify-center rotate-12">
                            <svg className="w-12 h-12 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── FORM PANEL ─────────────────────────────────────────────── */}
            <div className="flex-1 flex items-start lg:items-start justify-center bg-white lg:rounded-l-3xl lg:shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)] px-4 sm:px-8 pt-8 pb-12 lg:pt-24 lg:pb-12 h-full overflow-y-scroll w-full">
                <div className="w-full max-w-md">

                    {/* Desktop heading */}
                    <div className="hidden lg:block text-left mb-8">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Create an account</h2>
                        <p className="mt-2 text-sm text-slate-500">Submit your application to join the team</p>
                    </div>

                    {/* Mobile heading */}
                    <div className="lg:hidden mb-6">
                        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Create an account</h2>
                        <p className="mt-1 text-sm text-slate-500">Fill in your details below to apply</p>
                    </div>

                    {/* ── Toast Notification ── */}
                    {notification && (
                        <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-auto sm:top-6 sm:w-auto z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${notification.type === "error" ? "bg-rose-600" : "bg-emerald-600"}`}>
                            {notification.type === "error" ? (
                                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : (
                                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                            {notification.msg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-xl border border-red-100 flex items-start gap-2">
                                <svg className="w-5 h-5 shrink-0 mt-px" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <Input
                            label="Full Name"
                            type="text"
                            name="name"
                            placeholder="e.g. John Doe"
                            onChange={handleChange}
                            value={formData.name}
                            required
                        />

                        <Input
                            label="Email Address"
                            type="email"
                            name="email"
                            placeholder="e.g. john@creativeworks.com"
                            onChange={handleChange}
                            value={formData.email}
                            required
                        />

                        {/* Password field + Strength Meter */}
                        <div>
                            <Input
                                label="Secure Password"
                                type="password"
                                name="password"
                                placeholder="Create a strong password"
                                onChange={handleChange}
                                value={formData.password}
                                required
                            />

                            {formData.password && (
                                <div className="mt-2.5 space-y-2">
                                    {/* Strength bars */}
                                    <div className="flex gap-1.5">
                                        {[1, 2, 3, 4].map((i) => (
                                            <div
                                                key={i}
                                                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= score ? strengthColors[score] : "bg-slate-200"}`}
                                            />
                                        ))}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className={`text-xs font-bold ${strengthTextColors[score]}`}>
                                            {strengthLabels[score]}
                                        </p>
                                        <p className="text-[10px] text-slate-400">{score}/4 requirements</p>
                                    </div>

                                    {/* Requirements grid */}
                                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                                        {[
                                            { key: "length", label: "8+ characters" },
                                            { key: "upper", label: "Uppercase (A–Z)" },
                                            { key: "number", label: "Number (0–9)" },
                                            { key: "special", label: "Special (!@#$%^&*)" },
                                        ].map(({ key, label }) => (
                                            <li key={key} className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${checks[key] ? "text-emerald-600" : "text-slate-400"}`}>
                                                {checks[key] ? (
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                ) : (
                                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <circle cx="12" cy="12" r="9" strokeWidth={2} />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01" />
                                                    </svg>
                                                )}
                                                {label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* Confirm Password + Match Indicator */}
                        <div>
                            <Input
                                label="Confirm Password"
                                type="password"
                                name="confirmPassword"
                                placeholder="Confirm your password"
                                onChange={handleChange}
                                value={formData.confirmPassword}
                                required
                            />
                            {formData.confirmPassword && (
                                <p className={`mt-1.5 text-xs font-semibold flex items-center gap-1.5 ${passwordsMatch ? "text-emerald-600" : "text-red-500"}`}>
                                    {passwordsMatch ? (
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                        </svg>
                                    ) : (
                                        <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    )}
                                    {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                                </p>
                            )}
                        </div>

                        {/* Department Role */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Department Role
                            </label>
                            <select
                                name="role"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors duration-200 appearance-none bg-no-repeat cursor-pointer text-sm"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                    backgroundPosition: `right 0.75rem center`,
                                    backgroundSize: `1.25em 1.25em`
                                }}
                                onChange={handleChange}
                                required
                                value={formData.role}
                            >
                                <option value="" disabled>Select your role</option>
                                <option value="developer">Developer</option>
                                <option value="designer">Designer</option>
                                <option value="seo">SEO</option>
                                <option value="marketing">Marketing</option>
                            </select>
                        </div>

                        {/* Submit button */}
                        <Button
                            type="submit"
                            className="w-full h-12 mt-2 text-base font-bold shadow-lg shadow-primary-600/20 transition-all"
                            disabled={loading || score < 4 || !passwordsMatch || !formData.role}
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Submitting...
                                </span>
                            ) : "Apply"}
                        </Button>
                    </form>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Already registered?{" "}
                        <Link to="/" className="font-semibold text-primary-600 hover:text-primary-500 transition-colors">
                            Log in instead
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;
