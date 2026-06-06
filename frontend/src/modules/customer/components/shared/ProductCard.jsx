import React from "react";
import { Heart, Plus, Minus, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWishlist } from "../../context/WishlistContext";
import { useCart } from "../../context/CartContext";
import { useToast } from "@shared/components/ui/Toast";
import { useCartAnimation } from "../../context/CartAnimationContext";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { motion, AnimatePresence } from "framer-motion";
import { useProductDetail } from "../../context/ProductDetailContext";

const ProductCard = React.memo(
  ({ product, badge, className, compact = false, neutralBg = false }) => {
    const { toggleWishlist: toggleWishlistGlobal, isInWishlist } = useWishlist();
    const { cart, addToCart, updateQuantity, removeFromCart } = useCart();
    const { showToast } = useToast();
    const { animateAddToCart, animateRemoveFromCart } = useCartAnimation();
    const { openProduct } = useProductDetail();
    const [showHeartPopup, setShowHeartPopup] = React.useState(false);
    const imageRef = React.useRef(null);

    const defaultVariant = React.useMemo(() => {
      const variants = Array.isArray(product?.variants) ? product.variants : [];
      if (variants.length === 0) return null;

      const displayed = Number(product?.price || 0);
      const displayedOriginal = Number(product?.originalPrice || 0);

      const matchesDisplayedPrice = (variant) => {
        const mrp = Number(variant?.price || 0);
        const sale = Number(variant?.salePrice || 0);
        const effective = sale > 0 && sale < mrp ? sale : mrp;

        if (Number.isFinite(displayedOriginal) && displayedOriginal > displayed) {
          if (effective === displayed && (mrp === displayedOriginal || displayedOriginal === 0)) {
            return true;
          }
        }
        return effective === displayed || mrp === displayed;
      };

      const picked = variants.find(matchesDisplayedPrice) || variants[0];
      const key = String(picked?.sku || picked?.name || "").trim();
      return {
        key,
        name: String(picked?.name || "").trim(),
      };
    }, [product]);

    const productId = product.id || product._id;
    const variantKey = String(defaultVariant?.key || "").trim();
    const cartKey = `${productId}::${variantKey || ""}`;

    const cartItem = React.useMemo(
      () =>
        cart.find(
          (item) =>
            `${item.id || item._id}::${String(item.variantSku || "").trim()}` ===
            cartKey,
        ),
      [cart, cartKey],
    );
    const quantity = cartItem ? cartItem.quantity : 0;
    const isWishlisted = isInWishlist(productId);

    const handleProductClick = React.useCallback(
      (e) => {
        if (openProduct) {
          e.preventDefault();
          openProduct(product);
        }
      },
      [openProduct, product],
    );

    const toggleWishlist = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!isWishlisted) {
          setShowHeartPopup(true);
          setTimeout(() => setShowHeartPopup(false), 1000);
        }

        toggleWishlistGlobal(product);
        showToast(
          isWishlisted
            ? `${product.name} removed from wishlist`
            : `${product.name} added to wishlist`,
          isWishlisted ? "info" : "success",
        );
      },
      [isWishlisted, toggleWishlistGlobal, product, showToast],
    );

    const handleAddToCart = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (imageRef.current) {
          animateAddToCart(
            imageRef.current.getBoundingClientRect(),
            product.image,
          );
        }
        addToCart({
          ...product,
          variantSku: variantKey,
          variantName: defaultVariant?.name || "",
        });
      },
      [animateAddToCart, product, addToCart, variantKey, defaultVariant?.name],
    );

    const handleIncrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        updateQuantity(productId, 1, variantKey);
      },
      [updateQuantity, productId, variantKey],
    );

    const handleDecrement = React.useCallback(
      (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (quantity === 1) {
          animateRemoveFromCart(product.image);
          removeFromCart(productId, variantKey);
        } else {
          updateQuantity(productId, -1, variantKey);
        }
      },
      [
        quantity,
        animateRemoveFromCart,
        product.image,
        removeFromCart,
        productId,
        updateQuantity,
        variantKey,
      ],
    );

    return (
      <div
        className={cn(
          "font-inter flex-shrink-0 w-full rounded-2xl overflow-hidden flex flex-col h-full bg-white border border-slate-100 shadow-[0_8px_20px_-8px_rgba(0,0,0,0.08)] cursor-pointer transition-all duration-300 hover:scale-[1.02]",
          className,
        )}
        onClick={handleProductClick}>
        {/* Image Section */}
        <div className="relative w-full aspect-square overflow-hidden bg-white">
          {/* Badge */}
          {(badge ||
            product.discount ||
            product.originalPrice > product.price) && (
              <div
                className="absolute top-2 left-2 z-10 bg-[#061939] text-white font-[800] rounded px-1.5 py-0.5 text-[8px] uppercase tracking-wide">
                {badge ||
                  product.discount ||
                  `${Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF`}
              </div>
            )}

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
                className="absolute top-3 right-3 z-50 pointer-events-none text-red-500">
                <Heart size={20} fill="currentColor" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Info Section */}
        <div className="flex flex-col flex-1 px-3 pt-3 pb-3">
          {/* Product name — fixed 2-line height */}
          <h4 className="text-[12px] font-semibold text-[#1A1A1A] leading-tight line-clamp-2 mb-1.5 min-h-[32px]">
            {product.name}
          </h4>

          {/* Price + Wishlist Row */}
          <div className="flex items-center justify-between mb-3 mt-auto">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14px] font-[800] text-[#1A1A1A]">₹{product.price}</span>
              {product.originalPrice > product.price && (
                <span className="text-[10px] font-medium text-slate-400 line-through">
                  ₹{product.originalPrice}
                </span>
              )}
            </div>

            {/* Wishlist Heart Button next to price */}
            <button
              onClick={toggleWishlist}
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

          {/* Add to cart / Quantity Selector — Full Width */}
          <div className="w-full">
            {quantity > 0 ? (
              <div className="flex items-center bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] text-white shadow-[0_4px_12px_rgba(6,25,57,0.15)] rounded-xl py-1.5 w-full justify-between">
                <button onClick={handleDecrement} className="px-3 text-white/80 hover:text-white active:scale-90 transition-transform">
                  <Minus size={10} strokeWidth={3} />
                </button>
                <span className="text-[11px] font-black text-white">{quantity}</span>
                <button onClick={handleIncrement} className="px-3 text-white/80 hover:text-white active:scale-90 transition-transform">
                  <Plus size={10} strokeWidth={3} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAddToCart}
                className="w-full py-2 bg-gradient-to-r from-[#061939] via-[#0E2C5E] to-[#061939] text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-[0_4px_12px_rgba(6,25,57,0.15)] active:scale-95 transition-all"
              >
                ADD
              </button>
            )}
          </div>
        </div>
      </div>
    );
  },
);

export default ProductCard;
