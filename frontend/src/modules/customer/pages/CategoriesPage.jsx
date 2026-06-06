import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Search } from 'lucide-react';
import { customerApi } from '../services/customerApi';
import { applyCloudinaryTransform } from '@/core/utils/imageUtils';
import { useLocation } from '../context/LocationContext';

const CategoriesPage = () => {
    const [groups, setGroups] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [productCounts, setProductCounts] = useState({});
    const navigate = useNavigate();
    const { currentLocation } = useLocation();
    const hasValidLocation = useMemo(() => {
        return Number.isFinite(currentLocation?.latitude) && Number.isFinite(currentLocation?.longitude);
    }, [currentLocation]);

    const fetchCategories = async () => {
        setIsLoading(true);
        try {
            const res = await customerApi.getCategories({ tree: true });
            if (res.data.success) {
                const tree = res.data.results || res.data.result || [];
                const formattedGroups = tree
                    .filter((header) => (header.name || '').trim().toLowerCase() !== 'all')
                    .map((header) => {
                        const categories = (header.children || []).map((cat) => ({
                            id: cat._id,
                            name: cat.name,
                            image: cat.image || "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=270/layout-engine/2022-11/Slice-1_9.png",
                        }));

                        return {
                            title: header.name,
                            categories,
                        };
                    })
                    .filter((group) => group.categories.length > 0);
                setGroups(formattedGroups);
            } else {
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // Dynamically fetch live product counts when categories or location coordinates change
    useEffect(() => {
        if (groups.length === 0) return;

        const fetchCounts = async () => {
            const flatCategories = [];
            groups.forEach((g) => flatCategories.push(...(g.categories || [])));

            const locationParams = {};
            if (hasValidLocation && currentLocation) {
                locationParams.lat = currentLocation.latitude;
                locationParams.lng = currentLocation.longitude;
            } else {
                setIsLoading(false);
                return;
            }

            const countsMap = {};
            await Promise.all(
                flatCategories.map(async (cat) => {
                    try {
                        const prodRes = await customerApi.getProducts({
                            categoryId: cat.id,
                            limit: 1,
                            ...locationParams,
                        });
                        if (prodRes.data?.success) {
                            const count = prodRes.data.result?.total ?? prodRes.data.results?.total ?? 0;
                            countsMap[cat.id] = count;
                        }
                    } catch (err) {
                        console.error(`Error fetching count for category ${cat.name}:`, err);
                        countsMap[cat.id] = 0;
                    }
                })
            );
            setProductCounts(countsMap);
            setIsLoading(false);
        };

        fetchCounts();
    }, [groups, currentLocation, hasValidLocation]);

    const filteredGroups = useMemo(() => {
        if (!searchTerm.trim()) return groups;
        const term = searchTerm.toLowerCase();
        return groups
            .map((group) => {
                const filteredCats = (group.categories || []).filter((cat) =>
                    (cat.name || "").toLowerCase().includes(term)
                );
                return {
                    ...group,
                    categories: filteredCats,
                };
            })
            .filter((group) => group.categories.length > 0);
    }, [groups, searchTerm]);

    const allCategories = useMemo(() => {
        const list = [];
        filteredGroups.forEach((group) => {
            list.push(...(group.categories || []));
        });

        if (!isLoading && Object.keys(productCounts).length > 0) {
            return list.filter((category) => (productCounts[category.id] || 0) >= 1);
        }

        return list;
    }, [filteredGroups, productCounts, isLoading]);

    return (
        <div className="min-h-screen bg-[#FDFDFD]" style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
            {/* Custom Premium Categories Header */}
            <div className="w-full">
                {/* Top Nav Bar */}
                <div className="bg-[#061939] text-white flex items-center justify-between h-14 px-4 relative">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-white/10 active:scale-90 transition-all border-none bg-transparent p-0 text-white cursor-pointer"
                        type="button"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="absolute left-1/2 -translate-x-1/2 text-[17px] font-bold tracking-tight">
                        Categories
                    </h1>
                    <div className="w-8 h-8" /> {/* Spacer to balance layout */}
                </div>

                {/* Search Bar Row */}
                <div className="bg-white px-4 py-3 flex items-center">
                    <div className="relative flex items-center w-full h-11 bg-[#F5F7FA]/75 border border-slate-100 rounded-2xl px-3.5 shadow-sm transition-all focus-within:border-slate-350 focus-within:bg-white focus-within:ring-1 focus-within:ring-slate-300">
                        <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
                        <input
                            type="text"
                            placeholder="Search categories..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none border-none p-0 focus:ring-0 focus:outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="max-w-[1280px] mx-auto px-4 pt-5 pb-20">
                {isLoading ? (
                    // Premium Skeleton Loader
                    <div className="grid grid-cols-4 gap-x-3.5 gap-y-5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 animate-pulse">
                        {[...Array(12)].map((_, i) => (
                            <div key={i} className="flex flex-col items-center gap-1.5">
                                <div className="w-full aspect-square bg-[#E5E5E7] rounded-full" />
                                <div className="h-3 bg-slate-200 rounded w-4/5" />
                            </div>
                        ))}
                    </div>
                ) : allCategories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-400 select-none animate-in fade-in duration-300">
                        <Search size={48} className="text-slate-300 mb-4" />
                        <span className="text-sm font-semibold">No categories found matching "{searchTerm}"</span>
                        <span className="text-xs text-slate-400 mt-1">Try searching for something else</span>
                    </div>
                ) : (
                    <div className="grid grid-cols-4 gap-x-3.5 gap-y-5 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8">
                        {allCategories.map((category) => {
                            return (
                                <Link
                                    to={`/category/${category.id}`}
                                    state={{ categoryName: category.name }}
                                    key={category.id}
                                    className="flex flex-col items-center gap-1.5 group cursor-pointer"
                                >
                                    {/* Circular Image Container Card */}
                                    <div className="relative aspect-square w-full rounded-full bg-[#F8F9FA] border border-slate-100/80 flex items-center justify-center overflow-hidden p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)] hover:border-slate-200 transition-all duration-300 hover:scale-[1.015]">
                                        <img
                                            src={applyCloudinaryTransform(category.image)}
                                            alt={category.name}
                                            loading="lazy"
                                            className="w-full h-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-[1.03]"
                                        />
                                    </div>

                                    {/* Category Name Label */}
                                    <span className="text-[11px] font-semibold text-slate-700 text-center leading-snug line-clamp-2 group-hover:text-[#061939] px-0.5 select-none">
                                        {category.name}
                                    </span>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CategoriesPage;
