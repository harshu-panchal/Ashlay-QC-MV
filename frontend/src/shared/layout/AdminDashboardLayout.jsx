import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import BottomNav from './BottomNav';
import { useAuth } from "@core/context/AuthContext";
import { cn } from '@/lib/utils';

const AdminDashboardLayout = ({ children, navItems, title }) => {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const { role } = useAuth();
    const location = useLocation();

    useEffect(() => {
        setIsSidebarOpen(false);
    }, [location.pathname]);

    return (
        <div className="min-h-screen mesh-gradient-light relative overflow-x-hidden">
            {/* Background Blobs for depth */}
            <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none"></div>
            <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-500/5 rounded-full blur-[120px] -z-10 animate-pulse pointer-events-none" style={{ animationDelay: '2s' }}></div>

            <Sidebar
                items={navItems}
                title={title}
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
            />
            <div className={cn("transition-all duration-300", (role === "admin" || role === "seller") ? "pl-0 md:pl-72" : "pl-72")}>
                <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
                <main className={cn("p-4 md:p-6 min-h-screen", (role === "admin" || role === "seller") ? "pt-20 md:pt-6 pb-24 md:pb-6" : "pt-20")}>
                    <div className="w-full pb-12">
                        {children}
                    </div>
                </main>
            </div>

            {(role === "admin" || role === "seller") && <BottomNav navItems={navItems} />}
        </div>
    );
};

export default AdminDashboardLayout;
