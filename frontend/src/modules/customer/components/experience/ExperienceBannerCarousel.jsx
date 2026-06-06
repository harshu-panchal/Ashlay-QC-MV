import React from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  applyCloudinaryTransform,
  buildCloudinarySrcSet,
  isCloudinaryUrl,
} from "@/core/utils/imageUtils";
import { isMobileOrWebView } from "@/core/utils/deviceUtils";

const BANNER_CHUNK_SIZE = 20;

const ExperienceBannerCarousel = ({
  section,
  items = [],
  fullWidth = false,
  slideGap = 0,
  edgeToEdge = false,
  isHero = false // Prop to separate Top Hero and Section layouts
}) => {
  if (!items || !items.length) return null;

  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef(null);

  // Parse items list
  const [visibleCount, setVisibleCount] = React.useState(() =>
    Math.min(items.length, BANNER_CHUNK_SIZE)
  );
  const visibleItems = React.useMemo(() => items.slice(0, visibleCount), [items, visibleCount]);

  React.useEffect(() => {
    setVisibleCount(Math.min(items.length, BANNER_CHUNK_SIZE));
    setActiveIndex(0);
  }, [items.length]);

  const hasMore = visibleCount < items.length;
  const loadMore = React.useCallback(() => {
    setVisibleCount((prev) => Math.min(items.length, prev + BANNER_CHUNK_SIZE));
  }, [items.length]);

  React.useEffect(() => {
    if (!hasMore) return;
    if (activeIndex >= visibleItems.length - 2) {
      loadMore();
    }
  }, [activeIndex, visibleItems.length, hasMore, loadMore]);

  const totalSlides = visibleItems.length;

  // Auto-play logic
  React.useEffect(() => {
    if (totalSlides <= 1) return;
    const intervalId = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, 4500);
    return () => clearInterval(intervalId);
  }, [totalSlides]);

  const handleDragEnd = (_, info) => {
    const threshold = 50;
    if (info.offset.x < -threshold) {
      setActiveIndex((prev) => Math.min(prev + 1, totalSlides - 1));
    } else if (info.offset.x > threshold) {
      setActiveIndex((prev) => Math.max(prev - 1, 0));
    }
  };

  const handleCardClick = (banner) => {
    if (banner.linkValue) {
      navigate(banner.linkValue);
    }
  };

  const getBannerOptimizedSrc = React.useCallback((url, mode = "fill") => {
    if (!url) return url;
    if (!isCloudinaryUrl(url)) return url;
    if (mode === "fit") {
      return applyCloudinaryTransform(url, "f_auto,q_auto,c_fit,w_824,h_380");
    }
    return applyCloudinaryTransform(url, "f_auto,q_auto,c_fill,g_auto,w_824,h_380");
  }, []);

  return (
    <div className={cn("overflow-hidden touch-pan-y relative w-full", isHero && fullWidth && "w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]")}>
      <motion.div
        ref={containerRef}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        animate={{ x: `-${(activeIndex / totalSlides) * 100}%` }}
        transition={isMobileOrWebView() ? { type: "tween", ease: "easeInOut", duration: 0.3 } : { type: "spring", stiffness: 300, damping: 30 }}
        className="flex"
        style={{ width: `${totalSlides * 100}%` }}
      >
        {visibleItems.map((banner, idx) => (
          <div
            key={idx}
            className="relative shrink-0 flex items-center justify-center px-2 md:px-4"
            style={{ width: `${100 / totalSlides}%` }}
            onClick={() => handleCardClick(banner)}
          >
            {isHero ? (
              /* Context 1: Top Hero Banners - Standard Cloudinary Layout */
              fullWidth ? (
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 412, h: 190 },
                          { w: 824, h: 380 },
                          { w: 1248, h: 570 },
                        ])
                      : undefined
                  }
                  sizes="100vw"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center pointer-events-none"
                  width={412}
                  height={190}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              ) : (
                <div className="w-full max-w-[560px] aspect-[16/9] overflow-hidden rounded-3xl bg-slate-100 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
                  <img
                    src={getBannerOptimizedSrc(banner.imageUrl)}
                    srcSet={
                      isCloudinaryUrl(banner.imageUrl)
                        ? buildCloudinarySrcSet(banner.imageUrl, [
                            { w: 560, h: 315 },
                            { w: 1120, h: 630 },
                          ])
                        : undefined
                    }
                    sizes="(max-width: 768px) 100vw, 560px"
                    alt={banner.title || section?.title || "Banner"}
                    className="w-full h-full object-cover object-center pointer-events-none"
                    width={560}
                    height={315}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "low"}
                    decoding="async"
                  />
                </div>
              )
            ) : (
              /* Context 2: Page Section Banners - Sleek, compact and using your uploaded images directly */
              <div className="w-full max-w-[560px] h-[100px] sm:h-[130px] md:h-[160px] lg:h-[180px] overflow-hidden rounded-[20px] md:rounded-[32px] bg-slate-100 shadow-[0_12px_28px_rgba(0,0,0,0.12)] relative cursor-pointer select-none group hover:scale-[1.015] hover:shadow-[0_20px_40px_rgba(0,0,0,0.22)] transition-all duration-300 border border-slate-150">
                <img
                  src={getBannerOptimizedSrc(banner.imageUrl)}
                  srcSet={
                    isCloudinaryUrl(banner.imageUrl)
                      ? buildCloudinarySrcSet(banner.imageUrl, [
                          { w: 560, h: 180 },
                          { w: 1120, h: 360 },
                        ])
                      : undefined
                  }
                  sizes="(max-width: 768px) 100vw, 560px"
                  alt={banner.title || section?.title || "Banner"}
                  className="w-full h-full object-cover object-center pointer-events-none group-hover:scale-[1.02] transition-transform duration-500"
                  width={560}
                  height={180}
                  loading={idx === 0 ? "eager" : "lazy"}
                  fetchPriority={idx === 0 ? "high" : "low"}
                  decoding="async"
                />
              </div>
            )}
          </div>
        ))}
      </motion.div>

      {/* Slide Indicators / Pagination Dots overlaid perfectly inside bottom-center */}
      {totalSlides > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 bg-black/10 backdrop-blur-[2px] px-2 py-0.5 rounded-full border border-white/5">
          {Array.from({ length: totalSlides }).map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full transition-all duration-300",
                idx === activeIndex ? "bg-white w-3 sm:w-4" : "bg-white/30"
              )}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExperienceBannerCarousel;
