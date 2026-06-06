import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../../../core/context/AuthContext';
import { useLocation as useAppLocation } from '../context/LocationContext';
import { customerApi } from '../services/customerApi';
import {
    Minus,
    Plus,
    X,
    Tag,
    ShieldCheck,
    ChevronLeft,
    ChevronRight,
    ShoppingBag,
    ArrowRight
} from 'lucide-react';
import { useToast } from '@shared/components/ui/Toast';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';

const CartPage = () => {
    const navigate = useNavigate();
    const { cart, removeFromCart, updateQuantity, cartTotal, clearCart } = useCart();
    const { isAuthenticated } = useAuth();
    const { currentLocation } = useAppLocation();
    const { showToast } = useToast();
    const [emptyBoxData, setEmptyBoxData] = useState(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Dynamic pricing preview states
    const [pricingPreview, setPricingPreview] = useState(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Dynamically load empty-box Lottie when cart is empty
    useEffect(() => {
        if (cart.length === 0) {
            import('../../../assets/lottie/Empty box.json')
                .then((m) => setEmptyBoxData(m.default))
                .catch(() => { });
        }
    }, [cart.length === 0]); // eslint-disable-line react-hooks/exhaustive-deps

    const buildAddressForOrder = () => {
        return {
            type: "Home",
            name: "Customer",
            address: currentLocation?.name || "81 Pipliyahana Road, Near 214, Indore",
            landmark: "",
            city: currentLocation?.city || "Indore - 452018",
            phone: "6268423925",
            location: currentLocation?.latitude && currentLocation?.longitude
                ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
                : undefined,
        };
    };

    // Debounced checkoutPreview to fetch real-time calculations dynamically
    useEffect(() => {
        if (!isAuthenticated || cart.length === 0) {
            setPricingPreview(null);
            return;
        }

        const buildPreviewPayload = () => {
            return {
                items: cart.map((item) => {
                    return {
                        product: item.id || item._id,
                        name: item.name,
                        variantSku: String(item.variantSku || "").trim(),
                        quantity: item.quantity,
                        price: item.price,
                        image: item.image,
                    };
                }),
                address: buildAddressForOrder(),
                discountTotal: 0,
                taxTotal: 0,
                tipAmount: 0,
                paymentMode: "COD",
                timeSlot: "now",
            };
        };

        const fetchPreview = async () => {
            try {
                setIsPreviewLoading(true);
                const res = await customerApi.checkoutPreview(buildPreviewPayload());
                if (res.data?.success) {
                    setPricingPreview(res.data.result?.breakdown ?? null);
                }
            } catch (error) {
                console.error("Cart preview calculations failed", error);
            } finally {
                setIsPreviewLoading(false);
            }
        };

        const timer = setTimeout(fetchPreview, 400);
        return () => clearTimeout(timer);
    }, [isAuthenticated, cart, currentLocation]);

    const handleRemove = (id, name, variantSku = "") => {
        removeFromCart(id, variantSku);
        showToast(`${name} removed from cart`, 'info');
    };

    const formatPrice = (val) => {
        return Number(val || 0).toLocaleString('en-IN');
    };

    // Calculate actual values dynamically
    const displayItemTotal = pricingPreview ? (pricingPreview.productSubtotal ?? cartTotal) : cartTotal;
    const displayHandlingFee = pricingPreview?.handlingFeeCharged ?? 0;
    const displayTax = pricingPreview?.taxTotal ?? 0;
    const displayGrandTotal = displayItemTotal + displayHandlingFee + displayTax;

    return (
        <div className="min-h-screen bg-[#F8F9FA] font-inter pb-32">
            <div className="mx-auto max-w-md bg-[#F8F9FA] min-h-screen flex flex-col relative">

                {/* Header */}
                <header className="flex items-center justify-between py-4 px-4 bg-white border-b border-slate-100 sticky top-0 z-20">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-10 h-10 flex items-center justify-start text-[#061939] hover:text-slate-600 active:scale-95 transition-transform"
                        aria-label="Go back"
                    >
                        <ChevronLeft size={24} strokeWidth={2.5} />
                    </button>
                    <h1 className="text-[17px] font-[800] text-[#061939] tracking-tight">Cart</h1>
                    <button
                        onClick={() => {
                            if (cart.length > 0) {
                                setIsEditMode(!isEditMode);
                            }
                        }}
                        className="w-10 text-right text-[15px] font-[700] text-[#061939] hover:text-slate-600 transition-colors"
                    >
                        {cart.length === 0 ? "" : (isEditMode ? "Done" : "Edit")}
                    </button>
                </header>

                <div className="flex-1 px-4 py-4 space-y-4">
                    {cart.length > 0 ? (
                        <>
                            {/* Product Items */}
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div
                                        key={`${item.id}::${String(item.variantSku || "").trim()}`}
                                        className="relative bg-white rounded-3xl p-4 border border-slate-100/80 shadow-sm flex items-center gap-4 transition-all duration-300 hover:shadow-md"
                                    >
                                        {/* Product Image */}
                                        <div className="h-[96px] w-[96px] rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            <img
                                                src={applyCloudinaryTransform(item.image)}
                                                alt={item.name}
                                                className="h-full w-full object-cover p-1 rounded-2xl"
                                                loading="lazy"
                                            />
                                        </div>

                                        {/* Product Details */}
                                        <div className="flex-1 min-w-0 pr-6 flex flex-col justify-between h-24">
                                            <div>
                                                <h3 className="text-[15px] font-[800] text-[#061939] leading-tight truncate">
                                                    {item.name}
                                                </h3>
                                                <p className="text-[13px] font-[600] text-slate-400 mt-1 capitalize">
                                                    {item.variantName || item.category || 'Standard'}
                                                </p>
                                            </div>
                                            <div className="text-[16px] font-[800] text-[#061939]">
                                                ₹{formatPrice(item.price)}
                                            </div>
                                        </div>

                                        {/* Delete Button (✕) */}
                                        <button
                                            onClick={() => handleRemove(item.id, item.name, item.variantSku)}
                                            className={`absolute top-4 right-4 p-1 text-slate-400 hover:text-rose-500 rounded-full transition-all duration-200 ${isEditMode ? 'scale-110 text-rose-500 bg-rose-50' : ''
                                                }`}
                                            aria-label={`Remove ${item.name}`}
                                        >
                                            <X size={16} strokeWidth={2.5} />
                                        </button>

                                        {/* Quantity Selector */}
                                        <div className="absolute bottom-4 right-4 flex items-center gap-3 border border-slate-200 bg-white px-2.5 py-1 rounded-xl shadow-sm">
                                            <button
                                                onClick={() => updateQuantity(item.id, -1, item.variantSku)}
                                                className="text-slate-400 hover:text-slate-800 transition-colors disabled:opacity-30 p-0.5"
                                                disabled={item.quantity <= 1}
                                            >
                                                <Minus size={13} strokeWidth={3.5} />
                                            </button>
                                            <span className="text-[13px] font-[800] text-[#061939] min-w-[12px] text-center">
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.id, 1, item.variantSku)}
                                                className="text-slate-400 hover:text-slate-800 transition-colors p-0.5"
                                            >
                                                <Plus size={13} strokeWidth={3.5} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Summary Card */}
                            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-3.5 relative overflow-hidden">
                                {isPreviewLoading && (
                                    <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-10 transition-all">
                                        <span className="text-xs font-bold text-slate-400 animate-pulse">Calculating...</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center text-[14px] font-[600] text-slate-500">
                                    <span>Item Total</span>
                                    <span className="font-[800] text-[#061939]">₹{formatPrice(displayItemTotal)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[14px] font-[600] text-slate-500">
                                    <span>Handling Fee</span>
                                    <span className="font-[800] text-[#061939]">₹{formatPrice(displayHandlingFee)}</span>
                                </div>
                                <div className="flex justify-between items-center text-[14px] font-[600] text-slate-500">
                                    <span>Tax</span>
                                    <span className="font-[800] text-[#061939]">₹{formatPrice(displayTax)}</span>
                                </div>
                                <div className="border-t border-slate-100 pt-3.5 flex justify-between items-center text-[16px] font-[800] text-[#061939]">
                                    <span>Subtotal</span>
                                    <span className="text-[17px]">₹{formatPrice(displayGrandTotal)}</span>
                                </div>
                                <div className="text-[11px] font-[600] text-slate-400/80 text-center pt-1 leading-normal italic">
                                    * Delivery charges will be calculated and added at checkout
                                </div>
                            </div>

                            {/* Safe and Secure Payments Banner */}
                            <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center gap-4">
                                <div className="h-11 w-11 rounded-full bg-[#ECF3FD] flex items-center justify-center text-[#1E3A8A] flex-shrink-0">
                                    <ShieldCheck size={22} className="stroke-[#1E3A8A]" strokeWidth={2.5} />
                                </div>
                                <div>
                                    <h4 className="text-[14px] font-[800] text-[#061939] leading-tight">Safe and Secure Payments</h4>
                                    <p className="text-[12px] font-[600] text-slate-400 mt-0.5 leading-snug">100% secure payments. Easy returns.</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        /* Empty Cart State */
                        <div className="mx-auto w-full max-w-sm mt-12 bg-white rounded-3xl border border-slate-100 p-8 shadow-sm text-center">
                            <div className="mx-auto mb-6 flex h-40 w-40 items-center justify-center rounded-[2rem] border border-brand-100 bg-gradient-to-br from-brand-50 to-white shadow-md">
                                {emptyBoxData ? (
                                    <Lottie
                                        animationData={emptyBoxData}
                                        loop
                                        className="h-32 w-32"
                                    />
                                ) : (
                                    <div className="h-32 w-32 flex items-center justify-center">
                                        <ShoppingBag size={48} className="text-slate-300" />
                                    </div>
                                )}
                            </div>
                            <h2 className="text-2xl font-[900] text-[#061939] leading-tight">
                                Your cart is empty
                            </h2>
                            <p className="mt-3 text-[14px] font-[600] text-slate-500 leading-relaxed">
                                Let's fill it with fresh essentials, daily favorites, and the things you need right now.
                            </p>
                            <Link
                                to="/categories"
                                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#061939] hover:bg-[#041126] text-white py-3.5 text-[15px] font-[800] transition-all active:scale-[0.98] shadow-md shadow-slate-900/10"
                            >
                                Start Shopping
                                <ArrowRight size={16} strokeWidth={2.5} />
                            </Link>
                        </div>
                    )}
                </div>

                {/* Sticky Proceed to Checkout Button */}
                {cart.length > 0 && (
                    <div className="fixed bottom-[64px] left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100/60 z-20 flex justify-center">
                        <div className="w-full max-w-md">
                            <Link to="/checkout" className="block">
                                <button className="w-full h-[58px] bg-[#061939] hover:bg-[#041126] active:scale-[0.98] transition-all text-[#F7F7F7] rounded-2xl flex items-center justify-between px-5 shadow-lg shadow-slate-900/10 font-bold border border-white/10">
                                    <span className="text-[15px] font-[800] tracking-wide">Proceed to Checkout</span>
                                    <span className="text-[16px] font-[800]">
                                        ₹{formatPrice(displayGrandTotal)}
                                    </span>
                                </button>
                            </Link>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default CartPage;
