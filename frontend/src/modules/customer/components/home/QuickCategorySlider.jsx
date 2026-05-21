import React from "react";
import { Link } from "react-router-dom";
import { applyCloudinaryTransform } from "@/core/utils/imageUtils";

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
            onClick={() => onCategoryClick(cat.id)}
            className="flex flex-col items-center gap-2 text-center"
            type="button"
          >
            <div className="h-14 w-14 md:h-16 md:w-16 rounded-full bg-slate-100 flex items-center justify-center">
              <img
                src={applyCloudinaryTransform(cat.image, "f_auto,q_auto,w_96,h_96,c_fit")}
                alt={cat.name}
                loading="lazy"
                className="h-8 w-8 md:h-9 md:w-9 object-contain"
              />
            </div>
            <span className="text-[11px] md:text-[12px] font-medium text-slate-700 leading-tight line-clamp-2">
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default React.memo(QuickCategorySlider);
