import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo
} from "react";
import axiosInstance from "@core/api/axios";
import { getWithDedupe } from "@core/api/dedupe";
import { DEFAULT_SETTINGS, applyThemeVariables } from "./SettingsDefaults";

// Create context with null so we can check if it's provided
const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSettings = useCallback(async (options = {}) => {
    try {
      setLoading(true);
      setError(null);
      // Use deduplicated fetch for app settings
      const res = await getWithDedupe("/settings", {}, { 
        ttl: 60 * 1000,
        forceRefresh: options.forceRefresh || false 
      });
      const data = res.data?.result || res.data;
      const merged = { ...DEFAULT_SETTINGS, ...data };
      
      // Override branding only in the frontend
      if (merged.appName && (merged.appName === "Appzeto Quick Commerce" || merged.appName === "Appzeto")) {
        merged.appName = "Ashlay E-Commerce";
      } else if (merged.appName && merged.appName.includes("Appzeto")) {
        merged.appName = merged.appName.replace(/Appzeto Quick Commerce/gi, "Ashlay E-Commerce").replace(/Appzeto/gi, "Ashlay");
      }

      if (merged.metaTitle && (merged.metaTitle === "Appzeto Quick Commerce" || merged.metaTitle === "Appzeto")) {
        merged.metaTitle = "Ashlay E-Commerce";
      } else if (merged.metaTitle && merged.metaTitle.includes("Appzeto")) {
        merged.metaTitle = merged.metaTitle.replace(/Appzeto Quick Commerce/gi, "Ashlay E-Commerce").replace(/Appzeto/gi, "Ashlay");
      }

      if (merged.companyName && (merged.companyName === "Appzeto Quick Commerce" || merged.companyName === "Appzeto")) {
        merged.companyName = "Ashlay E-Commerce";
      } else if (merged.companyName && merged.companyName.includes("Appzeto")) {
        merged.companyName = merged.companyName.replace(/Appzeto Quick Commerce/gi, "Ashlay E-Commerce").replace(/Appzeto/gi, "Ashlay");
      }

      setSettings(merged);
      applyThemeVariables(merged);
    } catch (err) {
      console.error("Failed to fetch settings", err);
      setError(
        err?.response?.data?.message ||
          err.message ||
          "Failed to load settings",
      );
      setSettings(DEFAULT_SETTINGS);
      applyThemeVariables(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // UseMemo to avoid rerenders of children if values haven't changed
  const value = useMemo(() => ({
    settings,
    loading,
    error,
    refetch: fetchSettings,
  }), [settings, loading, error, fetchSettings]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
};

export default SettingsContext;
