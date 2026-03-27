import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../services/api";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import logo from "../../assets/sj-logo.png";

const ResetPassword = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        email: sessionStorage.getItem("resetEmail") || "",
        otp: "",
        password: "",
        confirmPassword: ""
    });
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [successMsg, setSuccessMsg] = useState("");

    const handleChange = (e) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.password !== formData.confirmPassword) {
            return setErrorMsg("Passwords do not match");
        }

        setLoading(true);
        setErrorMsg("");
        setSuccessMsg("");
        try {
            const res = await api.post("/auth/reset-password", {
                email: formData.email,
                otp: formData.otp,
                newPassword: formData.password
            });
            setSuccessMsg(res.data.message || "Password reset successful!");
            sessionStorage.removeItem("resetEmail");
            setTimeout(() => {
                navigate("/");
            }, 3000);
        } catch (error) {
            setErrorMsg(error.response?.data?.message || "Failed to reset password. Check your OTP.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
            <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden text-white flex-col justify-center items-center p-12">
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-secondary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 text-center w-full max-w-lg">
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-xl shadow-primary-500/20 p-2 overflow-hidden">
                        <img src={logo} alt="SJ Creativeworks Logo" className="w-full h-full object-contain drop-shadow-md" />
                    </div>
                    <h1 className="text-5xl font-extrabold tracking-tight mb-6">Create New Password</h1>
                    <p className="text-lg text-primary-100 mb-10 leading-relaxed">
                        Almost there. Enter the 6-digit OTP sent to your email and set your new secure password.
                    </p>
                </div>
            </div>

            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10 bg-white md:rounded-l-3xl shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]">
                <div className="w-full max-w-md">
                    <div className="lg:hidden flex justify-center mb-6">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20 p-2 border border-slate-100">
                            <img src={logo} alt="SJ Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    <div className="text-center lg:text-left mb-8">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Reset Password</h2>
                        <p className="mt-2 text-sm text-slate-600">Enter your OTP and new password details</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 flex items-start gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {errorMsg}
                            </div>
                        )}
                        {successMsg && (
                            <div className="p-3 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-lg border border-emerald-100 flex items-start gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                {successMsg}
                            </div>
                        )}

                        <Input
                            label="Email Address"
                            type="email"
                            name="email"
                            placeholder="you@creativeworks.com"
                            onChange={handleChange}
                            value={formData.email}
                            required
                        />

                        <Input
                            label="6-Digit OTP"
                            type="text"
                            name="otp"
                            placeholder="Enter 6-digit code"
                            maxLength="6"
                            onChange={handleChange}
                            value={formData.otp}
                            required
                        />

                        <Input
                            label="New Password"
                            type="password"
                            name="password"
                            placeholder="Enter new password"
                            onChange={handleChange}
                            value={formData.password}
                            required
                        />

                        <Input
                            label="Confirm New Password"
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm new password"
                            onChange={handleChange}
                            value={formData.confirmPassword}
                            required
                        />

                        <Button type="submit" className="w-full h-11 mt-2 text-base shadow-primary-600/10" disabled={loading}>
                            {loading ? "Resetting..." : "Reset Password"}
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-600">
                        Back to{" "}
                        <Link to="/" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ResetPassword;
