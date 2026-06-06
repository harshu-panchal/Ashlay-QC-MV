import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@core/context/AuthContext';
import { UserRole } from '@core/constants/roles';
import Button from '@shared/components/ui/Button';
import Input from '@shared/components/ui/Input';
import { motion, AnimatePresence } from 'framer-motion';
import AshlayLogoWhite from '../assets/ashlay_logo_white.webp';
import AshlayLogoDark from '../assets/ashlay_logo_dark.webp';

const Login = () => {
    const [showSplash, setShowSplash] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState(UserRole.CUSTOMER);
    const { login } = useAuth();
    const navigate = useNavigate();

    React.useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        const userData = {
            id: '1',
            name: `Demo ${role}`,
            email,
            role,
            token: 'demo-token',
        };
        login(userData);
        navigate(`/${role}`);
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8 overflow-hidden font-inter">
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

            <div className="w-full max-w-md space-y-8 rounded-2xl bg-white p-10 shadow-[0_15px_50px_rgba(6,25,57,0.08)] border border-slate-100/50 z-10">
                <div className="flex flex-col items-center">
                    {!showSplash && (
                        <motion.div layoutId="ashlayLogo" className="mb-4">
                            <img
                                src={AshlayLogoDark}
                                alt="Ashlay Logo"
                                className="h-16 w-auto object-contain"
                            />
                        </motion.div>
                    )}
                    <h2 className="text-center text-2xl font-black text-gray-900 tracking-tight leading-none mb-1">
                        Welcome Back
                    </h2>
                    <p className="text-center text-xs font-bold text-gray-400 uppercase tracking-widest leading-none">
                        Sign in to your account
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="space-y-4 rounded-md shadow-sm">
                        <Input
                            label="Email address"
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="user@example.com"
                        />
                        <Input
                            label="Password"
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                        />
                        <div className="w-full">
                            <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                            <select
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-[#061939] focus:ring-[#061939] sm:text-sm font-bold text-gray-800 p-2 border"
                                value={role}
                                onChange={(e) => setRole(e.target.value)}
                            >
                                <option value={UserRole.CUSTOMER}>Customer</option>
                                <option value={UserRole.SELLER}>Seller</option>
                                <option value={UserRole.ADMIN}>Admin</option>
                                <option value={UserRole.DELIVERY}>Delivery Partner</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <Button type="submit" className="w-full bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] border-0 text-white rounded-xl shadow-md py-4 text-xs font-black tracking-widest hover:shadow-lg transition-all uppercase">
                            Sign In
                        </Button>
                    </div>

                    <div className="text-center space-y-2">
                        <p className="text-sm text-gray-600">
                            Don't have an account?{' '}
                            <span className="cursor-pointer font-medium text-[#061939] hover:underline" onClick={() => navigate('/signup')}>
                                Sign up
                            </span>
                        </p>
                        <p className="text-sm text-gray-600">
                            Are you a seller?{' '}
                            <span className="cursor-pointer font-medium text-[#061939] hover:underline" onClick={() => navigate('/seller/auth')}>
                                Join as Partner
                            </span>
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default Login;
