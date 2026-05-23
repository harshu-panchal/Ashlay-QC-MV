import React from "react";
import { ChevronRight, Heart, Plus, Minus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useProductDetail } from "../../context/ProductDetailContext";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { useToast } from "@shared/components/ui/Toast";

export const LowestPriceCard = ({ product }) => {
  const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
  const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
  const { openProduct } = useProductDetail();
  const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();
  const { showToast } = useToast();
  const imageRef = React.useRef(null);
  const [showHeartPopup, setShowHeartPopup] = React.useState(false);

  const productId = product.id || product._id;
  const isWishlisted = isInWishlist(productId);

  // Match variant key the same way ProductCard does
  const defaultVariant = React.useMemo(() => {
    const variants = Array.isArray(product?.variants) ? product.variants : [];
    if (!variants.length) return null;
    const displayed = Number(product?.price || 0);
    const displayedOriginal = Number(product?.originalPrice || 0);
    const picked =
      variants.find((v) => {
        const mrp = Number(v?.price || 0);
        const sale = Number(v?.salePrice || 0);
        const effective = sale > 0 && sale < mrp ? sale : mrp;
        if (displayedOriginal > displayed) {
          return effective === displayed && (mrp === displayedOriginal || displayedOriginal === 0);
        }
        return effective === displayed || mrp === displayed;
      }) || variants[0];
    return { key: String(picked?.sku || picked?.name || "").trim(), name: String(picked?.name || "").trim() };
  }, [product]);

  const variantKey = String(defaultVariant?.key || "").trim();
  const cartKey = `${productId}::${variantKey}`;
  const cartItem = React.useMemo(
    () => cart.find((item) => `${item.id || item._id}::${String(item.variantSku || "").trim()}` === cartKey),
    [cart, cartKey]
  );
  const quantity = cartItem ? cartItem.quantity : 0;

  const discountPct =
    product.originalPrice > product.price
      ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
      : null;

  const handleClick = (e) => {
    if (openProduct) { e.preventDefault(); openProduct(product); }
  };

  const handleWishlist = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (!isWishlisted) { setShowHeartPopup(true); setTimeout(() => setShowHeartPopup(false), 1000); }
    toggleWishlistGlobal(product);
    showToast(isWishlisted ? `${product.name} removed from wishlist` : `${product.name} added to wishlist`, isWishlisted ? "info" : "success");
  };

  const handleAdd = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (imageRef.current) animateAddToCart(imageRef.current.getBoundingClientRect(), product.image);
    addToCart({ ...product, variantSku: variantKey, variantName: defaultVariant?.name || "" });
  };

  const handleIncrement = (e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(productId, 1, variantKey); };
  const handleDecrement = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (quantity === 1) { animateRemoveFromCart(product.image); removeFromCart(productId, variantKey); }
    else updateQuantity(productId, -1, variantKey);
  };

  return (
    <div
      onClick={handleClick}
      className="font-inter w-[148px] shrink-0 snap-start cursor-pointer group bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
    >
      {/* Image box */}
      <div className="relative w-full aspect-square overflow-hidden bg-white">
        <img
          ref={imageRef}
          src={applyCloudinaryTransform(product.image)}
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover mix-blend-multiply transition-transform duration-500 group-hover:scale-105"
        />

        {/* Heart popup animation */}
        <AnimatePresence>
          {showHeartPopup && (
            <motion.div
              initial={{ scale: 0.5, opacity: 1, y: 0 }}
              animate={{ scale: 2, opacity: 0, y: -40 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="absolute top-3 right-3 z-50 pointer-events-none text-red-500"
            >
              <Heart size={20} fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Content below image — flex-1 so ADD button is always at bottom */}
      <div className="flex flex-col flex-1 px-2.5 pt-2.5 pb-2.5">
        {/* Product name — fixed 2-line height */}
        <h4 className="text-[12px] font-semibold text-[#1A1A1A] leading-tight line-clamp-2 mb-1.5 min-h-[32px]">
          {product.name}
        </h4>

        {/* Price + wishlist row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[13px] font-[800] text-[#1A1A1A]">₹{product.price}</span>
            {product.originalPrice > product.price && (
              <span className="text-[9px] font-medium text-slate-400 line-through">
                ₹{product.originalPrice}
              </span>
            )}
          </div>

          {/* Wishlist */}
          <button
            onClick={handleWishlist}
            className="h-7 w-7 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center active:scale-90 transition-all"
          >
            <motion.div whileTap={{ scale: 0.8 }} animate={isWishlisted ? { scale: [1, 1.2, 1] } : {}}>
              <Heart
                size={12}
                className={cn(isWishlisted ? "text-red-500 fill-current" : "text-slate-400")}
              />
            </motion.div>
          </button>
        </div>

        {/* Add to cart / quantity — pinned to bottom */}
        <div className="mt-auto">
          {quantity > 0 ? (
            <div className="flex items-center bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] text-white shadow-[0_4px_12px_rgba(6,25,57,0.15)] rounded-xl py-1.5 w-full justify-between">
              <button onClick={handleDecrement} className="px-2 text-white/80 hover:text-white active:scale-90 transition-transform">
                <Minus size={10} strokeWidth={3} />
              </button>
              <span className="text-[11px] font-black text-white">{quantity}</span>
              <button onClick={handleIncrement} className="px-2 text-white/80 hover:text-white active:scale-90 transition-transform">
                <Plus size={10} strokeWidth={3} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleAdd}
              className="w-full py-2 bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-[0_4px_12px_rgba(6,25,57,0.15)] active:scale-95 transition-all"
            >
              ADD
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const LowestPriceSection = ({ products, onSeeAll }) => {
  if (!products || products.length === 0) return null;

  return (
    <div className="mb-4 md:mb-8">
      <div className="px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-[16px] md:text-[18px] font-bold text-[#1A1A1A] leading-none">
              Top Picks For You
            </h3>

          </div>
          <button
            onClick={onSeeAll}
            className="flex items-center gap-0.5 text-[#061939] font-bold text-[13px] active:scale-95 transition-transform"
          >
            View all
          </button>
        </div>

        {/* Cards row */}
        <div className="flex overflow-x-auto gap-3 pb-2 no-scrollbar snap-x snap-mandatory scroll-smooth">
          {products.slice(0, 7).map((product) => (
            <LowestPriceCard key={product.id || product._id} product={product} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default React.memo(LowestPriceSection);
