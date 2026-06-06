import React from "react";
import { Wallet } from "lucide-react";
import { motion } from "framer-motion";

/**
 * CheckoutPaymentSelector
 *
 * Props:
 *   paymentMethods  – array of { id, label, icon, sublabel }
 *   selectedPayment – string id of the currently selected method
 *   onSelectPayment – (id) => void
 *   useWallet       – boolean
 *   onToggleWallet  – () => void
 *   walletBalance   – number (0 means wallet section is hidden)
 *   walletAmountToUse – number
 */
const CheckoutPaymentSelector = React.memo(function CheckoutPaymentSelector({
  paymentMethods,
  selectedPayment,
  onSelectPayment,
  useWallet,
  onToggleWallet,
  walletBalance,
  walletAmountToUse,
}) {
  return (
    <>
      {/* Wallet Section */}
      {walletBalance > 0 && (
        <motion.div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 overflow-hidden relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-[#F4F7FD] flex items-center justify-center">
                <Wallet size={16} className="text-[#061939]" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm tracking-tight">
                  Use wallet balance
                </h3>
                <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                  Available: ₹{walletBalance}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleWallet}
              className={`w-12 h-6 rounded-full transition-all duration-300 relative flex items-center px-1 ${
                useWallet ? "bg-[#061939]" : "bg-slate-200"
              }`}>
              <motion.div
                animate={{ x: useWallet ? 24 : 0 }}
                className="h-4 w-4 rounded-full bg-white shadow-sm"
              />
            </button>
          </div>
          {useWallet && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="pt-2 border-t border-slate-50 mt-2">
              <div className="flex justify-between items-center bg-[#F4F7FD]/50 p-2 rounded-xl">
                <span className="text-[11px] font-bold text-slate-600 uppercase">
                  Amount to be used
                </span>
                <span className="text-[13px] font-black text-[#061939]">
                  ₹{walletAmountToUse}
                </span>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}

      {/* Payment Method */}
      <motion.div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="font-bold text-slate-800 text-sm tracking-tight">
            Payment method
          </h3>
        </div>
        <div className="space-y-2">
          {paymentMethods.map((method) => {
            const Icon = method.icon;
            const isSelected = selectedPayment === method.id;
            return (
              <button
                key={method.id}
                onClick={() => onSelectPayment(method.id)}
                className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                  isSelected
                    ? "border-[#061939] bg-[#F4F7FD]"
                    : "border-slate-200 bg-white hover:border-slate-300"
                }`}>
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${
                    isSelected ? "bg-[#E6ECF8]" : "bg-slate-100"
                  }`}>
                  <Icon
                    size={18}
                    className={
                      isSelected ? "text-[#061939]" : "text-slate-600"
                    }
                  />
                </div>
                <div className="flex-1 text-left">
                  <p
                    className={`font-bold text-sm ${
                      isSelected ? "text-[#061939]" : "text-slate-800"
                    }`}>
                    {method.label}
                  </p>
                  <p className="text-xs text-slate-500">{method.sublabel}</p>
                </div>
                <div
                  className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isSelected ? "border-[#061939]" : "border-slate-300"
                  }`}>
                  {isSelected && (
                    <div className="h-3 w-3 rounded-full bg-[#061939]" />
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
});

export default CheckoutPaymentSelector;
