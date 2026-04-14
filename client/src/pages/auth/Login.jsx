import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../../config/axiosConfig";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import logo from "../../assets/sj-logo.png";
import { useAuth } from "../../context/AuthContext";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [notification, setNotification] = useState(null);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await api.post("/auth/login", formData);
      const { token, role, name } = res.data;
      login({ token, role, name });
      showNotification("Login successful! Redirecting...");

      setTimeout(() => {
        if (role === "admin") {
          navigate("/admin/dashboard", { replace: true });
        } else {
          navigate("/employee/dashboard", { replace: true });
        }
      }, 1000);
    } catch (error) {
      setErrorMsg(error.response?.data?.message || "Login failed");
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
          <h1 className="text-5xl font-extrabold tracking-tight mb-6">SJ Creativeworks</h1>
          <p className="text-lg text-primary-100 mb-10 leading-relaxed">
            Welcome back. Access your attendance dashboard and keep your records in sync.
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
            <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">Access your attendance and leave tools</p>
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
              label="Email Address"
              type="email"
              name="email"
              placeholder="you@creativeworks.com"
              onChange={handleChange}
              value={formData.email}
              required
            />

            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="Your secure password"
              onChange={handleChange}
              value={formData.password}
              required
            />

            <div className="flex justify-end">
              <Link to="/forgot-password" size="sm" className="text-sm font-medium text-primary-600 hover:text-primary-500 transition-colors">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" className="w-full h-11 mt-2 text-base shadow-primary-600/10" disabled={loading}>
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Trouble logging in? Contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
