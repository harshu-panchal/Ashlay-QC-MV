import React from 'react';
import { useSettings } from '@core/context/SettingsContext';

const MobileFooterMessage = () => {
    const { settings } = useSettings();
    const appName = settings?.appName || 'Ashlay';
    return (
        <div
            className="md:hidden w-full flex flex-col items-center -mt-16 pt-0 pb-20 px-6 bg-transparent select-none"
            style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}
        >
            <div className="w-full flex flex-col max-w-md">
                <h2 className="text-[36px] leading-[1.05] font-black text-slate-300/90 tracking-tight text-left">
                    India's last<br />minute app <span className="inline-block animate-pulse text-red-500">❤️</span>
                </h2>

                <div className="w-full h-[1px] bg-gradient-to-r from-slate-200 via-slate-200/50 to-transparent mt-6 mb-5"></div>

                <div className="flex flex-col items-start">
                    <span className="text-slate-300/95 font-black text-[26px] tracking-tight leading-none mb-10">
                        {appName}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default MobileFooterMessage;
