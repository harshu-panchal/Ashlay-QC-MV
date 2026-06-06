import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import SearchIcon from "@mui/icons-material/Search";
import MicIcon from "@mui/icons-material/Mic";

const PageSearchBar = ({ className = "" }) => {
  const navigate = useNavigate();
  const [searchPlaceholder, setSearchPlaceholder] = useState("Search ");
  const [typingState, setTypingState] = useState({
    textIndex: 0,
    charIndex: 0,
    isDeleting: false,
    isPaused: false,
  });

  const staticText = "Search ";
  const typingPhrases = [
    '"bread"',
    '"milk"',
    '"chocolate"',
    '"eggs"',
    '"chips"',
  ];

  useEffect(() => {
    const { textIndex, charIndex, isDeleting, isPaused } = typingState;
    const currentPhrase = typingPhrases[textIndex];

    if (isPaused) {
      const timeout = setTimeout(() => {
        setTypingState((prev) => ({
          ...prev,
          isPaused: false,
          isDeleting: true,
        }));
      }, 2000);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIndex < currentPhrase.length) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex + 1)
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex + 1,
            }));
          } else {
            setTypingState((prev) => ({ ...prev, isPaused: true }));
          }
        } else {
          if (charIndex > 0) {
            setSearchPlaceholder(
              staticText + currentPhrase.substring(0, charIndex - 1)
            );
            setTypingState((prev) => ({
              ...prev,
              charIndex: prev.charIndex - 1,
            }));
          } else {
            setTypingState((prev) => ({
              ...prev,
              isDeleting: false,
              textIndex: (prev.textIndex + 1) % typingPhrases.length,
            }));
          }
        }
      },
      isDeleting ? 50 : 100
    );

    return () => clearTimeout(timeout);
  }, [typingState]);

  const handleSearchClick = () => {
    navigate("/search");
  };

  return (
    <div className={`w-full max-w-[880px] mx-auto px-4 ${className}`}>
      <motion.div
        onClick={handleSearchClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="rounded-2xl bg-white px-4 h-12 shadow-sm border border-slate-100 flex items-center transition-all duration-200 cursor-pointer focus-within:ring-2 focus-within:ring-primary/20"
      >
        <SearchIcon sx={{ color: "#9ca3af", fontSize: 22 }} />
        <input
          type="text"
          placeholder={searchPlaceholder || "Search Products..."}
          readOnly
          className="flex-1 bg-transparent border-none outline-none pl-2.5 text-slate-800 font-medium placeholder:text-slate-400 text-[15px] cursor-pointer"
        />
        <div className="flex items-center gap-2 border-l border-slate-100 pl-3">
          <MicIcon sx={{ color: "#9ca3af", fontSize: 20 }} />
        </div>
      </motion.div>
    </div>
  );
};

export default PageSearchBar;
