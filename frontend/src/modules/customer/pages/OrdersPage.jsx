import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Package,
    ChevronRight,
    Loader2,
    ChevronLeft,
    ShoppingBag,
    CreditCard,
    Banknote,
    Headphones,
    CheckCircle,
    Truck,
    RefreshCw,
    XCircle,
    Wallet
} from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { getLegacyStatusFromOrder } from '@/shared/utils/orderStatus';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const OrdersPage = () => {
    const navigate = useNavigate();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('All');

    const tabs = ['All', 'Confirmed', 'Out For Delivery', 'Delivered', 'Cancelled'];

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await customerApi.getMyOrders();
                const payload = response?.data;
                const items =
                    payload?.result?.items ||
                    payload?.results ||
                    [];
                setOrders(Array.isArray(items) ? items : []);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, []);

    const formatPrice = (val) => {
        return Number(val || 0).toLocaleString('en-IN');
    };

    const formatDate = (dateStr) => {
        return new Date(dateStr).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    // Filter logic based on active tab
    const filteredOrders = orders.filter((order) => {
        const legacy = getLegacyStatusFromOrder(order);
        const statusLower = String(order.status || '').toLowerCase();
        if (activeTab === 'All') return true;
        if (activeTab === 'Confirmed') {
            return ['placed', 'accepted', 'preparing', 'packed', 'processing', 'confirmed', 'pending'].includes(legacy) || 
                   ['placed', 'accepted', 'preparing', 'packed', 'processing', 'confirmed', 'pending'].includes(statusLower);
        }
        if (activeTab === 'Out For Delivery') {
            return ['out_for_delivery', 'shipped', 'dispatched'].includes(legacy) ||
                   ['out_for_delivery', 'shipped', 'dispatched'].includes(statusLower);
        }
        if (activeTab === 'Delivered') return legacy === 'delivered' || statusLower === 'delivered';
        if (activeTab === 'Cancelled') return legacy === 'cancelled' || statusLower === 'cancelled';
        return true;
    });

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#F8F9FA]">
                <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white shadow-sm border border-slate-100">
                    <Loader2 className="animate-spin text-[#061939]" size={22} />
                    <span className="text-sm font-semibold text-slate-500 font-inter">Loading your orders…</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F9FA] font-inter pb-32">
            <div className="mx-auto max-w-md bg-[#F8F9FA] min-h-screen flex flex-col relative">
                
                {/* Header */}
                <header className="flex items-center justify-between py-4 px-4 bg-white sticky top-0 z-20">
                    <button
                        onClick={() => navigate('/')}
                        className="w-10 h-10 flex items-center justify-start hover:bg-slate-50 rounded-full transition-colors"
                    >
                        <ChevronLeft size={22} strokeWidth={2.5} className="text-[#061939]" />
                    </button>
                    <h1 className="text-[17px] font-[800] text-[#061939] tracking-tight">My Orders</h1>
                    <Link
                        to="/cart"
                        className="w-10 h-10 flex items-center justify-end hover:bg-slate-50 rounded-full transition-colors"
                    >
                        <ShoppingBag size={20} strokeWidth={2.5} className="text-[#061939]" />
                    </Link>
                </header>

                {/* Filter Tabs scrollbar */}
                <div className="flex gap-2.5 overflow-x-auto no-scrollbar px-4 py-3.5 bg-white border-b border-slate-100 sticky top-[56px] z-10">
                    {tabs.map((tab) => {
                        const isActive = activeTab === tab;
                        return (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-shrink-0 px-4 py-2 rounded-xl text-[13px] font-[700] transition-all relative ${
                                    isActive
                                        ? 'text-[#061939] border border-[#061939]/30 bg-[#F4F7FD]'
                                        : 'text-slate-500 border border-slate-200/80 bg-white hover:bg-slate-50'
                                }`}
                            >
                                {tab}
                                {isActive && (
                                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2.5px] bg-[#061939] rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 px-4 py-4 space-y-4">
                    {filteredOrders.length > 0 ? (
                        <>
                            {/* Order Cards List */}
                            <div className="space-y-3">
                                {filteredOrders.map((order) => {
                                    const legacy = getLegacyStatusFromOrder(order);
                                    const statusLower = String(order.status || '').toLowerCase();
                                    
                                    // Determine status variables
                                    let statusText = 'Confirmed';
                                    let statusColor = 'text-slate-400';
                                    let StatusIcon = XCircle;

                                    if (['delivered'].includes(legacy) || statusLower === 'delivered') {
                                        statusText = 'Delivered';
                                        statusColor = 'text-[#16A34A]'; // Premium forest green
                                        StatusIcon = CheckCircle;
                                    } else if (['out_for_delivery', 'shipped', 'dispatched'].includes(legacy) || statusLower === 'out_for_delivery') {
                                        statusText = 'Out For Delivery';
                                        statusColor = 'text-[#2563EB]'; // Electric blue
                                        StatusIcon = Truck;
                                    } else if (['placed', 'accepted', 'preparing', 'packed', 'processing', 'confirmed', 'pending'].includes(legacy) || ['placed', 'accepted', 'preparing', 'packed', 'pending'].includes(statusLower)) {
                                        statusText = 'Confirmed';
                                        statusColor = 'text-[#D97706]'; // Amber orange
                                        StatusIcon = RefreshCw;
                                    } else if (['cancelled'].includes(legacy) || statusLower === 'cancelled') {
                                        statusText = 'Cancelled';
                                        statusColor = 'text-[#94A3B8]'; // Cool slate gray for cancelled
                                        StatusIcon = XCircle;
                                    }

                                    // Fully dynamic payment mode validation (checking paymentMode + payment.method selection fields)
                                    const paymentMethodNorm = String(order.payment?.method || '').toLowerCase();
                                    const paymentModeNorm = String(order.paymentMode || '').toUpperCase();
                                    
                                    const isCod = paymentModeNorm === 'COD' || paymentMethodNorm === 'cash' || paymentMethodNorm === 'cod';
                                    const isWallet = paymentMethodNorm === 'wallet' || paymentModeNorm === 'WALLET';

                                    return (
                                        <div
                                            key={order._id}
                                            className="bg-white rounded-3xl p-6 border border-slate-100/80 shadow-sm flex items-center justify-between gap-4 transition-all duration-300 hover:shadow-md"
                                        >
                                            {/* Product Thumbnail */}
                                            <div className="h-24 w-24 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {order.items[0]?.image ? (
                                                    <img
                                                        src={applyCloudinaryTransform(order.items[0].image)}
                                                        alt={order.items[0]?.name || 'Order thumbnail'}
                                                        className="h-full w-full object-cover p-1 rounded-2xl"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <Package size={24} className="text-slate-300" />
                                                )}
                                            </div>

                                            {/* Info Column */}
                                            <div className="flex-1 min-w-0 pr-1 flex flex-col justify-between h-auto py-1">
                                                <div>
                                                    <h3 className="text-[13px] font-[800] text-[#061939] leading-tight truncate">
                                                        {order.orderId}
                                                    </h3>
                                                    <p className="text-[11px] font-[600] text-slate-400 mt-0.5 leading-snug">
                                                        {formatDate(order.createdAt)} • {order.items.length} {order.items.length === 1 ? 'Item' : 'Items'}
                                                    </p>
                                                </div>
                                                <div className="mt-2.5">
                                                    <div className="text-[15px] font-[800] text-[#061939] leading-none">
                                                        ₹{formatPrice(order.pricing?.total || 0)}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 mt-1.5">
                                                        {isCod ? (
                                                            <>
                                                                <Banknote size={12} className="text-slate-400" />
                                                                <span className="text-[10px] font-[600] text-slate-400">Cash on Delivery</span>
                                                            </>
                                                        ) : isWallet ? (
                                                            <>
                                                                <Wallet size={12} className="text-slate-400" />
                                                                <span className="text-[10px] font-[600] text-slate-400">Paid via Wallet</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <CreditCard size={12} className="text-slate-400" />
                                                                <span className="text-[10px] font-[600] text-slate-400">Paid Online</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Status & View Details Column */}
                                            <div className="flex flex-col items-end justify-between h-auto py-1 shrink-0 gap-3">
                                                <div className="text-right flex flex-col items-end">
                                                    <span className={`text-[12px] font-[800] ${statusColor} capitalize leading-tight`}>
                                                        {statusText}
                                                    </span>
                                                    <span className="text-[9px] font-[600] text-slate-400 mt-0.5">
                                                        {formatDate(order.updatedAt || order.createdAt)}
                                                    </span>
                                                    <div className="mt-1 flex items-center justify-center">
                                                        <StatusIcon size={14} className={`stroke-[2.5] ${statusColor}`} />
                                                    </div>
                                                </div>

                                                <Link to={`/orders/${order.orderId}`}>
                                                    <button className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200/80 rounded-xl text-[11px] font-[800] text-slate-700 hover:bg-slate-50 transition-colors active:scale-95">
                                                        View Details
                                                        <ChevronRight size={11} strokeWidth={3.5} className="text-slate-400" />
                                                    </button>
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Help / Support Banner */}
                            <div className="bg-[#F4F7FE]/75 rounded-3xl p-5 border border-blue-50 flex items-center justify-between gap-4 mt-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-11 w-11 rounded-full bg-[#ECF3FD] flex items-center justify-center text-blue-600 shrink-0">
                                        <Headphones size={20} className="stroke-blue-600" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h4 className="text-[14px] font-[800] text-[#061939] leading-tight">Need Help?</h4>
                                        <p className="text-[12px] font-[600] text-slate-400 mt-0.5 leading-snug">Have an issue with your order?</p>
                                    </div>
                                </div>
                                <Link to="/support" className="shrink-0">
                                    <button className="bg-white border border-slate-200/80 hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all text-[#061939] px-4 py-2 rounded-xl text-[12px] font-[800] shadow-sm">
                                        Contact Support
                                    </button>
                                </Link>
                            </div>
                        </>
                    ) : (
                        /* Empty State */
                        <div className="mx-auto w-full max-w-sm mt-12 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm text-center">
                            <div className="mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-[2rem] border border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-md">
                                <Package size={48} className="text-slate-300" />
                            </div>
                            <h2 className="text-2xl font-[900] text-[#061939] leading-tight">
                                No orders yet
                            </h2>
                            <p className="mt-3 text-[14px] font-[600] text-slate-500 leading-relaxed">
                                When you place an order, it will appear here so you can track it easily.
                            </p>
                            <Link
                                to="/"
                                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#061939] hover:bg-[#041126] text-white py-3.5 text-[15px] font-[800] transition-all active:scale-[0.98] shadow-md shadow-slate-900/10"
                            >
                                Start Shopping
                                <ChevronRight size={16} strokeWidth={2.5} />
                            </Link>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default OrdersPage;
