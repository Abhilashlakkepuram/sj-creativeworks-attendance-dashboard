import { useState } from "react";
import api from "../../config/axiosConfig";
import { useNavigate, Link } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import logo from "../../assets/sj-logo.png";

function Register() {
    const navigate = useNavigate();

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
        role: ""
    });

    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [notification, setNotification] = useState(null);

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
        <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">

            {/* Left Side - Animated Banner & Company Name */}
            <div className="hidden lg:flex lg:w-1/2 relative bg-primary-900 overflow-hidden text-white flex-col justify-center items-center p-12">
                {/* Background animations */}
                <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-primary-600 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
                <div className="absolute top-[10%] right-[-10%] w-96 h-96 bg-secondary-500 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-10%] left-[20%] w-96 h-96 bg-primary-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

                <div className="relative z-10 text-center w-full max-w-lg">
                    {/* Company Logo / Identifier */}
                    <div className="w-24 h-24 bg-white/10 backdrop-blur-lg rounded-2xl flex items-center justify-center mx-auto mb-8 border border-white/20 shadow-xl shadow-primary-500/20 p-2 overflow-hidden">
                        <img src={logo} alt="SJ Creativeworks Logo" className="w-full h-full object-contain drop-shadow-md" />
                    </div>

                    <h1 className="text-5xl font-extrabold tracking-tight mb-6">
                        SJ Creativeworks
                    </h1>
                    <p className="text-lg text-primary-100 mb-10 leading-relaxed">
                        Join our team of developers, designers, and creatives. Streamline your workflow and track your daily progress with our intelligent attendance platform.
                    </p>

                    {/* Floating elements animation */}
                    <div className="relative w-full h-48 mt-8">
                        {/* Floating Element 1 - Top Left */}
                        <div className="absolute top-0 left-10 w-24 h-24 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 animate-[bounce_4s_infinite] shadow-2xl flex items-center justify-center">
                            <svg className="w-10 h-10 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                        </div>

                        {/* Floating Element 2 - Top Right */}
                        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 backdrop-blur-md rounded-full border border-white/20 animate-[bounce_5s_infinite_1s] shadow-2xl flex items-center justify-center">
                            <svg className="w-8 h-8 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" /></svg>
                        </div>

                        {/* Floating Element 3 - Bottom Center */}
                        <div className="absolute bottom-0 left-1/3 w-28 h-28 bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 animate-[bounce_6s_infinite_0.5s] shadow-2xl flex items-center justify-center rotate-12">
                            <svg className="w-12 h-12 text-primary-200" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        </div>
                    </div>
                </div>
            </div>

            {/* Right Side - Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 sm:p-12 relative z-10 bg-white md:rounded-l-3xl shadow-[-10px_0_30px_-15px_rgba(0,0,0,0.1)]">
                <div className="w-full max-w-md">

                    {/* Mobile Logo Fallback */}
                    <div className="lg:hidden flex justify-center mb-6">
                        <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/20 p-2 border border-slate-100">
                            <img src={logo} alt="SJ Logo" className="w-full h-full object-contain" />
                        </div>
                    </div>

                    <div className="text-center lg:text-left mb-8">
                        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
                            Create an account
                        </h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Submit your application to join the team
                        </p>
                    </div>

                    {/* Toast notification */}
                    {notification && (
                        <div className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-white text-sm font-medium animate-fade-in transition-all ${notification.type === "error" ? "bg-rose-600" : "bg-emerald-600"}`}>
                            {notification.type === "error" ? (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            ) : (
                                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            )}
                            {notification.msg}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {errorMsg && (
                            <div className="p-3 bg-red-50 text-red-600 text-sm font-medium rounded-lg border border-red-100 flex items-start gap-2">
                                <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {errorMsg}
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

                        <Input
                            label="Secure Password"
                            type="password"
                            name="password"
                            placeholder="Create a strong password"
                            onChange={handleChange}
                            value={formData.password}
                            required
                        />
                        <Input
                            label="Confirm Password"
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm your password"
                            onChange={handleChange}
                            value={formData.confirmPassword}
                            required
                        />
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Department Role
                            </label>
                            <select
                                name="role"
                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-colors duration-200 appearance-none bg-no-repeat cursor-pointer"
                                style={{
                                    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
                                    backgroundPosition: `right 0.5rem center`,
                                    backgroundSize: `1.5em 1.5em`
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

                        <Button
                            type="submit"
                            className="w-full h-11 mt-4 text-base shadow-primary-600/10"
                            disabled={loading}
                        >
                            {loading ? "Submitting application..." : "Apply"}
                        </Button>
                    </form>

                    <p className="mt-8 text-center text-sm text-slate-600">
                        Registered already ?{" "}
                        <Link to="/" className="font-medium text-primary-600 hover:text-primary-500 transition-colors">
                            Log in instead
                        </Link>
                    </p>
                </div>
            </div>

        </div>
    );
}

export default Register;
