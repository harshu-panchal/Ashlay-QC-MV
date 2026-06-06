import React from "react";
import { Link } from "react-router-dom";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";
import { ICON_COMPONENTS } from "../../constants/homeConstants";
import { getIconSvg } from "@shared/constants/categoryIcons";
import { Sparkles } from "lucide-react";

const QuickCategorySlider = ({ categories, onCategoryClick }) => {
  if (!categories || categories.length === 0) return null;
  const visibleCategories = categories.slice(0, 5);

  return (
    <div className="w-full mt-2 mb-14 md:mt-4 md:mb-16 px-4 md:px-6 lg:px-8">
      <div className="mb-3 md:mb-4 flex items-center justify-between">
        <h2 className="text-[16px] md:text-[18px] font-bold text-[#061939] leading-none">
          Shop by Categories
        </h2>
        <Link
          to="/categories"
          className="text-[12px] md:text-[13px] font-bold text-[#061939] hover:text-slate-900"
        >
          View All
        </Link>
      </div>

      <div className="grid grid-cols-5 gap-2 md:gap-4">
        {visibleCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => onCategoryClick(cat.id, cat.name)}
            className="flex flex-col items-center gap-2 text-center group"
            type="button"
          >
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-[#E2E3E6] flex items-center justify-center transition-all hover:scale-105 hover:bg-[#d6d8dd] active:scale-95 duration-200">
              {cat.iconId && ICON_COMPONENTS[cat.iconId] ? (
                (() => {
                  const IconComp = ICON_COMPONENTS[cat.iconId];
                  return <IconComp className="h-8 w-8 md:h-9 md:w-9 text-[#061939]" />;
                })()
              ) : cat.iconId && getIconSvg(cat.iconId) ? (
                <div
                  className="h-8 w-8 md:h-9 md:w-9 text-[#061939] flex items-center justify-center"
                  dangerouslySetInnerHTML={{
                    __html: getIconSvg(cat.iconId),
                  }}
                />
              ) : (
                <img
                  src={applyCloudinaryTransform(cat.image, "f_auto,q_auto,w_96,h_96,c_fit")}
                  alt={cat.name}
                  loading="lazy"
                  className="h-8 w-8 md:h-9 md:w-9 object-contain"
                />
              )}
            </div>
            <span className="text-[10px] md:text-[12px] font-medium text-slate-700 leading-tight line-clamp-2 group-hover:text-[#061939] transition-colors">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(QuickCategorySlider);
