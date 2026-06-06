import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { useSettings } from '@core/context/SettingsContext';
import {
    Phone,
    ShieldCheck,
    User,
    ChevronRight,
    ChevronLeft
} from 'lucide-react';
import { toast } from 'sonner';
import { customerApi } from '../services/customerApi';
import BgImage from '@/assets/image.png';
import AshlayLogoWhite from '@/assets/ashlay_logo_white.webp';

const STORE_IMAGE = "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&q=80&w=600";

const CustomerAuth = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [showOtp, setShowOtp] = useState(false);
    const [timer, setTimer] = useState(0);
    const { login } = useAuth();
    const { settings } = useSettings();
    const appName = settings?.appName || 'Ashlay';
    const navigate = useNavigate();

    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const [formData, setFormData] = useState({
        phone: '',
        otp: '',
        name: ''
    });

    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendOtp = async (e) => {
        e?.preventDefault();
        if (formData.phone.length !== 10) {
            toast.error('Enter valid 10-digit number');
            return;
        }
        setIsLoading(true);
        try {
            if (isLogin) {
                await customerApi.sendLoginOtp({ phone: formData.phone });
            } else {
                await customerApi.sendSignupOtp({ name: formData.name, phone: formData.phone });
            }
            setShowOtp(true);
            setTimer(30);
            toast.success('OTP sent!');
        } catch (error) {
            toast.error('Failed to send OTP');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e) => {
        e.preventDefault();
        if (formData.otp.length !== 4) {
            toast.error('Enter 4-digit code');
            return;
        }
        setIsLoading(true);
        try {
            const response = await customerApi.verifyOtp({ phone: formData.phone, otp: formData.otp });
            const { token, customer } = response.data.result;
            login({ ...customer, token, role: 'customer' });
            toast.success('Successfully Logged In!');
            navigate('/');
        } catch (error) {
            const apiMessage = error?.response?.data?.message;
            toast.error(apiMessage || 'Invalid OTP');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full relative flex items-center justify-center font-inter overflow-hidden">
            <AnimatePresence>
                {showSplash && (
                    <motion.div
                        key="splash"
                        className="absolute inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-[#061939] via-[#0E2C5E] to-[#061939]"
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeInOut" }}
                    >
                        <motion.div
                            layoutId="ashlayLogo"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.8, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 100, damping: 15 }}
                        >
                            <img
                                src={AshlayLogoWhite}
                                alt="Ashlay Logo"
                                className="h-24 w-auto object-contain drop-shadow-[0_0_30px_rgba(255,255,255,0.45)]"
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Premium Brand Atmospheric Background */}
            <div 
                className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: `url(${BgImage})` }}
            >
                <div className="absolute inset-0 opacity-90 bg-gradient-to-br from-[#061939] via-[#0E2C5E] to-[#061939] backdrop-blur-md" />
            </div>

            {/* Animated Blurred Blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <motion.div
                    animate={{
                        x: [0, 50, 0],
                        y: [0, 30, 0],
                        scale: [1, 1.2, 1]
                    }}
                    transition={{
                        x: { duration: 8, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 10, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: 12, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-[100px] opacity-25 bg-[#0E2C5E]"
                />
                <motion.div
                    animate={{
                        x: [0, -40, 0],
                        y: [0, -60, 0],
                        scale: [1, 1.1, 1]
                    }}
                    transition={{
                        x: { duration: 9, repeat: Infinity, ease: "easeInOut" },
                        y: { duration: 7, repeat: Infinity, ease: "easeInOut" },
                        scale: { duration: 15, repeat: Infinity, ease: "easeInOut" }
                    }}
                    className="absolute -bottom-24 -right-24 w-[500px] h-[500px] rounded-full blur-[120px] opacity-35 bg-[#061939]"
                />
            </div>

            {/* Premium Centered Card Container */}
            <div className="w-[92%] max-w-[400px] h-[85vh] max-h-[780px] bg-white relative z-10 overflow-hidden rounded-[40px] shadow-[0_50px_100px_-20px_rgba(6,25,57,0.3)] border border-white/20 flex flex-col transition-colors duration-1000">

                {/* Scrollable Content Container */}
                <div className="h-full overflow-y-auto no-scrollbar pb-20">

                    {/* Header: Immersive Visual with bluish overlay */}
                    <div className="relative h-[38%] w-full overflow-hidden bg-[#061939]">
                        <img
                            src={STORE_IMAGE}
                            className="w-full h-full object-cover opacity-60"
                            loading="lazy"
                            alt="Store banner"
                        />
                        {/* Bluish overlay wash */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#061939]/80 via-[#0E2C5E]/50 to-[#061939] mix-blend-multiply" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#061939]/20 to-[#061939]" />

                        {/* Centered Logo & Tagline */}
                        <div className="absolute inset-x-0 top-0 bottom-12 flex flex-col items-center justify-center text-center px-8 text-white">
                            {!showSplash && (
                                <motion.div layoutId="ashlayLogo" className="mb-2.5">
                                    <img
                                        src={AshlayLogoWhite}
                                        alt="Ashlay Logo"
                                        className="h-16 w-auto object-contain drop-shadow-[0_4px_15px_rgba(0,0,0,0.25)]"
                                    />
                                </motion.div>
                            )}
                            <p className="text-[13px] font-medium tracking-tight text-white/95 drop-shadow-[0_2px_5px_rgba(0,0,0,0.3)] font-inter">
                                Your Everyday. Your Style. Your Ashlay.
                            </p>
                        </div>

                        {/* S-Curve Divider */}
                        <div className="absolute -bottom-1 left-0 w-full leading-[0]">
                            <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="w-full h-20">
                                <path
                                    fill="#ffffff"
                                    d="M0,224L40,213.3C80,203,160,181,240,186.7C320,192,400,224,480,240C560,256,640,256,720,234.7C800,213,880,171,960,165.3C1040,160,1120,192,1200,208C1280,224,1360,224,1400,224L1440,224L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"
                                />
                            </svg>
                        </div>
                    </div>

                    {/* Authentication Form Block */}
                    <div className="px-6 pt-4 pb-10">
                        <AnimatePresence mode="wait">
                            {!showOtp ? (
                                <motion.div
                                    key="main-form"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-5"
                                >
                                    {/* App Style Tab Switcher */}
                                    <div className="flex bg-slate-50 rounded-2xl p-1.5 border border-slate-100/85 shadow-inner">
                                        <button
                                            onClick={() => setIsLogin(true)}
                                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${isLogin ? 'bg-[#061939] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Login
                                        </button>
                                        <button
                                            onClick={() => setIsLogin(false)}
                                            className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${!isLogin ? 'bg-[#061939] text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                                        >
                                            Sign Up
                                        </button>
                                    </div>

                                    <div className="space-y-2 text-center">
                                        <h3 className="text-xl font-black text-[#061939] tracking-tight">
                                            {isLogin ? 'Welcome Back!' : 'Create Account'}
                                        </h3>
                                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-none">
                                            OTP will be sent for verification
                                        </p>
                                    </div>

                                    <form onSubmit={handleSendOtp} className="space-y-4">
                                        {!isLogin && (
                                            <div className="relative group">
                                                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors">
                                                    <User size={18} className="group-focus-within:text-[#061939]" />
                                                </div>
                                                <input
                                                    required
                                                    name="name"
                                                    placeholder="Full Name"
                                                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-slate-800 outline-none focus:bg-white transition-all focus:border-[#061939]"
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    onFocus={(e) => e.target.style.borderColor = '#061939'}
                                                    onBlur={(e) => e.target.style.borderColor = '#F3F4F6'}
                                                />
                                            </div>
                                        )}
                                        <div className="relative group">
                                            <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-sm text-slate-400 border-r border-slate-200 pr-3 h-5 flex items-center">
                                                +91
                                            </div>
                                            <input
                                                required
                                                name="phone"
                                                maxLength={10}
                                                placeholder="Mobile Number"
                                                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-[74px] pr-4 py-4 text-sm font-bold text-slate-800 outline-none focus:bg-white transition-all focus:border-[#061939]"
                                                value={formData.phone}
                                                onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                                                onFocus={(e) => e.target.style.borderColor = '#061939'}
                                                onBlur={(e) => e.target.style.borderColor = '#F3F4F6'}
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={isLoading || formData.phone.length !== 10}
                                            className={`w-full py-4 rounded-[20px] text-sm font-semibold tracking-normal flex items-center justify-center gap-3 active:scale-95 transition-all font-inter ${
                                                formData.phone.length === 10
                                                    ? "bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] text-white shadow-[0_12px_25px_rgba(6,25,57,0.2)] hover:shadow-[0_15px_35px_rgba(6,25,57,0.3)]"
                                                    : "bg-slate-100 text-slate-400 cursor-not-allowed shadow-none"
                                            }`}
                                        >
                                            {isLoading ? 'Verifying...' : 'Continue'}
                                            <ChevronRight size={18} />
                                        </button>
                                    </form>

                                    {/* Legal Agreement Footer */}
                                    <div className="pt-2 flex flex-col items-center gap-1">
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest text-center">
                                            By continuing, you agree to our
                                        </p>
                                        <div className="flex items-center gap-1.5 underline decoration-slate-200 underline-offset-4">
                                            <button 
                                                onClick={() => navigate('/terms')}
                                                className="text-[10px] font-black uppercase tracking-widest hover:text-[#0E2C5E] transition-colors text-[#061939]"
                                            >
                                                Terms & Condition
                                            </button>
                                            <span className="text-[8px] text-slate-300">•</span>
                                            <button 
                                                onClick={() => navigate('/privacy-policy')}
                                                className="text-[10px] font-black uppercase tracking-widest hover:text-[#0E2C5E] transition-colors text-[#061939]"
                                            >
                                                Privacy Policy
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="otp-view"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className="space-y-10"
                                >
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setShowOtp(false)}
                                            className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                                        >
                                            <ChevronLeft size={20} />
                                        </button>
                                        <div className="font-inter">
                                            <h3 className="text-xl font-black text-[#061939] tracking-tight font-inter">Enter OTP</h3>
                                            <p className="text-[10px] font-black tracking-widest text-slate-400 uppercase font-inter">+91 {formData.phone}</p>
                                        </div>
                                    </div>

                                    <form onSubmit={handleVerifyOtp} className="space-y-10 font-inter">
                                        <div className="flex justify-between gap-3 px-1">
                                            {[...Array(4)].map((_, i) => (
                                                <input
                                                    key={i}
                                                    type="tel"
                                                    maxLength={1}
                                                    className="w-14 h-16 bg-white border-2 border-slate-200 rounded-3xl text-center text-2xl font-black outline-none shadow-[0_12px_35px_rgba(6,25,57,0.15)] focus:bg-white focus:border-[#061939] focus:shadow-[0_18px_45px_rgba(6,25,57,0.25)] transition-all font-inter"
                                                    style={{ color: '#061939' }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Backspace' && !e.target.value && i > 0) {
                                                            e.target.previousElementSibling.focus();
                                                        }
                                                    }}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        if (val && i < 3) (e.target.nextElementSibling).focus();
                                                        const otpArr = formData.otp.split('');
                                                        otpArr[i] = val;
                                                        setFormData({ ...formData, otp: otpArr.join('') });
                                                    }}
                                                    onFocus={(e) => e.target.style.borderColor = '#061939'}
                                                    onBlur={(e) => e.target.style.borderColor = ''}
                                                />
                                            ))}
                                        </div>

                                        <div className="space-y-4">
                                            <button
                                                type="submit"
                                                disabled={isLoading}
                                                className="w-full text-white py-4 rounded-[20px] text-sm font-semibold tracking-normal flex items-center justify-center gap-3 active:scale-95 transition-all bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] shadow-[0_12px_25px_rgba(6,25,57,0.2)] hover:shadow-[0_15px_35px_rgba(6,25,57,0.3)] font-inter"
                                            >
                                                {isLoading ? 'Authenticating...' : `Enter ${appName}`}
                                            </button>
                                            <div className="flex justify-center">
                                                <button
                                                    type="button"
                                                    disabled={timer > 0}
                                                    onClick={handleSendOtp}
                                                    className={`text-[10px] font-black uppercase tracking-widest ${timer > 0 ? 'text-slate-300' : 'underline text-[#061939] hover:text-[#0E2C5E]'}`}
                                                >
                                                    {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Now'}
                                                </button>
                                            </div>
                                        </div>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                </div>
            </div>

            {/* Desktop Branding Stamp */}
            <div className="hidden md:block absolute bottom-10 right-10 text-white/20 text-xs font-bold uppercase tracking-[4px]">
                {appName.toUpperCase()} CUSTOMER PORTAL
            </div>
        </div>
    );
};

export default CustomerAuth;
