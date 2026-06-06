import React from "react";
import { Clipboard, Tag, Heart, Wallet } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutPricingBreakdown
 *
 * Props:
 *   pricingPreview    – breakdown object from the preview API (or null)
 *   isPreviewLoading  – boolean
 *   selectedTip       – number
 *   onSelectTip       – (value) => void
 *   tipAmounts        – array of { value, label }
 *   walletAmountToUse – number
 *   finalAmountToPay  – number
 *   cartTotal         – number (fallback when preview is loading)
 *   selectedCoupon    – coupon object or null
 *   discountAmount    – number
 */
const CheckoutPricingBreakdown = React.memo(function CheckoutPricingBreakdown({
  pricingPreview,
  isPreviewLoading,
  selectedTip,
  onSelectTip,
  tipAmounts,
  walletAmountToUse,
  finalAmountToPay,
  cartTotal,
  selectedCoupon,
  discountAmount,
}) {
  const deliveryFee = pricingPreview?.deliveryFeeCharged || 0;
  const handlingFee = pricingPreview?.handlingFeeCharged || 0;
  const tipAmount = pricingPreview?.tipTotal || selectedTip || 0;
  const taxAmount = pricingPreview?.taxTotal || 0;

  return (
    <>
      {/* Tip for Partner */}
      <motion.div className="bg-gradient-to-r from-pink-50/60 to-purple-50/60 rounded-2xl p-4 border border-pink-100/70">
        <div className="flex items-center gap-2 mb-2">
          <Heart size={16} className="text-pink-500 fill-pink-500" />
          <h3 className="font-bold text-slate-800 text-sm">Tip your delivery partner</h3>
        </div>
        <p className="text-xs text-slate-500 mb-3">100% of the tip goes directly to them</p>
        <div className="grid grid-cols-4 gap-2">
          {tipAmounts.map((tip) => (
            <button
              key={tip.value}
              onClick={() => onSelectTip(tip.value)}
              className={`py-1.5 rounded-xl border transition-all font-semibold text-xs ${
                selectedTip === tip.value
                  ? "border-pink-500 bg-pink-100/50 text-pink-700 font-bold"
                  : "border-slate-200 bg-white text-slate-600 hover:border-pink-300"
              }`}>
              {tip.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Bill Details */}
      <motion.div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-5">
          <div className="h-8 w-8 rounded-xl bg-[#F4F7FD] flex items-center justify-center">
            <Clipboard size={16} className="text-[#061939]" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">
            Order summary
          </h3>
        </div>

        <div className="space-y-3.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 font-medium text-xs">
              Item total
            </span>
            <span className="font-semibold text-slate-800 text-xs">
              ₹{pricingPreview?.productSubtotal ?? cartTotal}
            </span>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 font-medium text-xs">
              Delivery fee
            </span>
            <span className="font-semibold text-slate-800 text-xs">₹{deliveryFee}</span>
          </div>
          {pricingPreview &&
            typeof pricingPreview.distanceKmActual === "number" &&
            typeof pricingPreview.distanceKmRounded === "number" && (
              <div className="px-1 -mt-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>
                  Distance: {pricingPreview.distanceKmActual.toFixed(2)} km
                  {pricingPreview.distanceKmRounded
                    ? ` (billed ${pricingPreview.distanceKmRounded.toFixed(2)} km)`
                    : ""}
                </span>
                <span>
                  {pricingPreview?.snapshots?.deliverySettings?.deliveryPricingMode ||
                    pricingPreview?.snapshots?.deliverySettings?.pricingMode ||
                    ""}
                </span>
              </div>
            )}
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 font-medium text-xs">
              Handling fee
            </span>
            <span className="font-semibold text-slate-800 text-xs">₹{handlingFee}</span>
          </div>
          <div className="flex justify-between items-center px-1">
            <span className="text-slate-500 font-medium text-xs">
              Tax
            </span>
            <span className="font-semibold text-slate-800 text-xs">₹{taxAmount}</span>
          </div>

          {selectedCoupon && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-2 bg-[#F4F7FD] rounded-xl border border-blue-50">
              <span className="text-[#061939] font-bold text-xs flex items-center gap-2">
                <Tag size={13} />
                Coupon reserved
              </span>
              <span className="font-bold text-[#061939] text-xs">-₹{discountAmount}</span>
            </motion.div>
          )}

          {tipAmount > 0 && (
            <div className="flex justify-between items-center px-3 py-2 bg-pink-50 rounded-xl border border-pink-100 italic">
              <span className="text-pink-600 font-medium text-xs flex items-center gap-2">
                <Heart size={13} className="fill-pink-500" />
                Partner support
              </span>
              <span className="font-semibold text-pink-600 text-xs">₹{tipAmount}</span>
            </div>
          )}

          {walletAmountToUse > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex justify-between items-center px-3 py-2 bg-[#F4F7FD] rounded-xl border border-blue-50 mb-2">
              <span className="text-[#061939] font-bold text-xs flex items-center gap-2">
                <Wallet size={13} />
                Wallet applied
              </span>
              <span className="font-bold text-[#061939] text-xs">-₹{walletAmountToUse}</span>
            </motion.div>
          )}

          <div className="mt-4 pt-4 border-t border-dashed border-slate-100">
            <div className="flex justify-between items-center">
              <div className="flex flex-col">
                <span className="font-bold text-slate-800 text-sm">
                  {finalAmountToPay === 0 ? "Fully covered" : "Total payable"}
                </span>
                <span className="text-[10px] text-slate-400 font-medium mt-0.5">
                  {finalAmountToPay === 0 ? "Paid via wallet" : "Safe & secure payment"}
                </span>
              </div>
              <span className="font-[800] text-[#061939] text-xl tracking-tight">
                {isPreviewLoading ? "Calculating..." : `₹${Math.ceil(finalAmountToPay)}`}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
});

export default CheckoutPricingBreakdown;
