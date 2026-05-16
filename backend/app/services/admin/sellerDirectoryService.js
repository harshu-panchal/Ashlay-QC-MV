import Seller from "../../models/seller.js";
import Order from "../../models/order.js";
import Product from "../../models/product.js";
import {
  computeMapBounds,
  computeMapCenter,
  escapeRegExp,
  extractSellerCity,
  getSellerDisplayLocation,
  hasValidSellerLocation,
  matchSellerLifecycleFilter,
  normalizeRadiusKm,
  resolveSellerLifecycleStatus,
  sortActiveSellerRows,
} from "./shared/sellerAdminUtils.js";

export async function getSellerLocationsData({
  q = "",
  category = "all",
  city = "all",
  lifecycle = "all",
  mapLimit: rawMapLimit = "500",
  sort = "orders_desc",
  page,
  limit,
  skip,
}) {
  const normalizedLifecycle = String(lifecycle || "all").trim().toLowerCase();
  const normalizedCategory = String(category || "all").trim();
  const normalizedCity = String(city || "all").trim();
  const normalizedSort = String(sort || "orders_desc").trim().toLowerCase();
  const search = String(q || "").trim();
  const requestedMapLimit = Number(rawMapLimit);
  const mapItemLimit = Number.isFinite(requestedMapLimit)
    ? Math.min(Math.max(requestedMapLimit, 0), 2000)
    : 500;

  const pipeline = [];

  // 1. Initial Match
  const match = { $and: [] };
  if (normalizedCategory && normalizedCategory !== "all") {
    match.$and.push({
      category: new RegExp(`^${escapeRegExp(normalizedCategory)}$`, "i"),
    });
  }
  if (search) {
    const searchRegex = new RegExp(escapeRegExp(search), "i");
    match.$and.push({
      $or: [
        { name: searchRegex },
        { shopName: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { address: searchRegex },
        { category: searchRegex },
      ],
    });
  }
  if (match.$and.length === 0) delete match.$and;
  if (Object.keys(match).length > 0) pipeline.push({ $match: match });

  // 2. Lookup Order Stats
  const activeStatuses = ["pending", "confirmed", "packed", "picked_up", "out_for_delivery"];
  const recentWindowStart = new Date(Date.now() - 24 * 60 * 60 * 1000);

  pipeline.push({
    $lookup: {
      from: "orders",
      let: { sellerId: "$_id" },
      pipeline: [
        { $match: { $expr: { $eq: ["$seller", "$$sellerId"] } } },
        {
          $group: {
            _id: null,
            totalOrders: { $sum: 1 },
            activeOrders: {
              $sum: {
                $cond: [{ $in: ["$status", activeStatuses] }, 1, 0],
              },
            },
            deliveredOrders: {
              $sum: {
                $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
              },
            },
            ordersLast24h: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", recentWindowStart] }, 1, 0],
              },
            },
            lastOrderAt: { $max: "$createdAt" },
          },
        },
      ],
      as: "orderStats",
    },
  });

  pipeline.push({
    $addFields: {
      orderStats: { $arrayElemAt: ["$orderStats", 0] },
    },
  });

  // 3. Project and Derive Fields
  pipeline.push({
    $project: {
      id: { $toString: "$_id" },
      shopName: { $ifNull: ["$shopName", "Unnamed Store"] },
      ownerName: { $ifNull: ["$name", "Unnamed Owner"] },
      email: { $ifNull: ["$email", ""] },
      phone: { $ifNull: ["$phone", ""] },
      category: { $ifNull: ["$category", "General"] },
      isActive: 1,
      isVerified: 1,
      applicationStatus: 1,
      reviewedAt: 1,
      createdAt: 1,
      location: 1,
      serviceRadius: 1,
      activeOrders: { $ifNull: ["$orderStats.activeOrders", 0] },
      totalOrders: { $ifNull: ["$orderStats.totalOrders", 0] },
      deliveredOrders: { $ifNull: ["$orderStats.deliveredOrders", 0] },
      ordersLast24h: { $ifNull: ["$orderStats.ordersLast24h", 0] },
      lastOrderAt: { $ifNull: ["$orderStats.lastOrderAt", null] },
    },
  });

  // 4. Sort and Lifecycle Filtering
  // Note: matchSellerLifecycleFilter is complex JS logic. 
  // We should ideally convert it to aggregation, but for now let's apply it carefully.
  // To keep it simple and scalable, we'll implement the lifecycle filter in aggregation.
  
  const lifecycleExpr = {
    $switch: {
      branches: [
        {
          case: { $eq: ["$applicationStatus", "rejected"] },
          then: "rejected",
        },
        {
          case: { $and: ["$isVerified", "$isActive"] },
          then: "active",
        },
        {
          case: { $and: ["$isVerified", { $eq: ["$isActive", false] }] },
          then: "inactive",
        },
        {
          case: { $and: [{ $eq: ["$isVerified", false] }, { $eq: ["$applicationStatus", "approved"] }] },
          then: "approved",
        },
        {
          case: { $eq: ["$applicationStatus", "pending"] },
          then: "pending",
        },
      ],
      default: "unknown",
    },
  };

  pipeline.push({
    $addFields: {
      lifecycle: lifecycleExpr,
      city: { $ifNull: ["$address", "Location not set"] }, // Simplified for aggregation
    },
  });

  if (normalizedLifecycle && normalizedLifecycle !== "all") {
    pipeline.push({ $match: { lifecycle: normalizedLifecycle } });
  }

  if (normalizedCity && normalizedCity !== "all") {
    pipeline.push({ $match: { city: new RegExp(escapeRegExp(normalizedCity), "i") } });
  }

  // 5. Final Sort and Facet
  const sortMap = {
    recent: { createdAt: -1 },
    name_asc: { shopName: 1 },
    name_desc: { shopName: -1 },
    orders_desc: { activeOrders: -1 },
    orders_asc: { activeOrders: 1 },
  };

  pipeline.push({
    $facet: {
      items: [
        { $sort: sortMap[normalizedSort] || sortMap.orders_desc },
        { $skip: skip },
        { $limit: limit },
      ],
      totalCount: [{ $count: "count" }],
      allCities: [
        { $group: { _id: "$city" } },
        { $match: { _id: { $ne: null } } },
        { $sort: { _id: 1 } },
      ],
      allCategories: [
        { $group: { _id: "$category" } },
        { $match: { _id: { $ne: null } } },
        { $sort: { _id: 1 } },
      ],
      mapItems: [
        { $match: { "location.coordinates": { $exists: true, $ne: [0, 0] } } },
        { $limit: mapItemLimit },
      ],
    },
  });

  const [result] = await Seller.aggregate(pipeline);
  const rows = result.items || [];
  const total = result.totalCount[0]?.count || 0;
  const pagedItems = rows;
  const mapItems = result.mapItems || [];
  const allCities = result.allCities.map((c) => c._id);
  const allCategories = result.allCategories.map((c) => c._id);

  const mapPoints = mapItems.map((item) => {
    const coords = Array.isArray(item.location?.coordinates) ? item.location.coordinates : [];
    return {
      lat: coords[1] || 0,
      lng: coords[0] || 0,
    };
  });
  const mappedCount = mapItems.length;
  const radiusValues = mapItems.map((row) => row.serviceRadius || 5);
  const totalActiveOrders = rows.reduce((acc, row) => acc + row.activeOrders, 0);
  const totalDeliveredOrders = rows.reduce((acc, row) => acc + row.deliveredOrders, 0);

  return {
    items: pagedItems,
    mapItems,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalSellers: rows.length,
      mappedSellers: mappedCount,
      unmappedSellers: Math.max(0, rows.length - mappedCount),
      citiesCovered: allCities.length,
      totalActiveOrders,
      totalDeliveredOrders,
      averageRadiusKm: radiusValues.length
        ? Number(
            (
              radiusValues.reduce((accumulator, value) => accumulator + value, 0) /
              radiusValues.length
            ).toFixed(2),
          )
        : 0,
      maxRadiusKm: radiusValues.length ? Math.max(...radiusValues) : 0,
    },
    filters: {
      categories: allCategories,
      cities: allCities,
      lifecycle: ["all", "active", "pending", "rejected", "inactive", "verified", "unverified"],
    },
    map: {
      center: computeMapCenter(mapPoints),
      bounds: computeMapBounds(mapPoints),
      itemLimit: mapItemLimit,
    },
    syncedAt: new Date().toISOString(),
  };
}

export async function getActiveSellersData({
  q = "",
  category = "all",
  sort = "recent",
  page,
  limit,
  skip,
}) {
  const baseQuery = { isVerified: true, isActive: true };
  const filters = [baseQuery];

  if (category && category !== "all") {
    filters.push({
      category: new RegExp(`^${escapeRegExp(category)}$`, "i"),
    });
  }

  const search = String(q || "").trim();
  if (search) {
    const regex = new RegExp(escapeRegExp(search), "i");
    filters.push({
      $or: [
        { name: regex },
        { shopName: regex },
        { email: regex },
        { phone: regex },
        { address: regex },
        { category: regex },
      ],
    });
  }

  const query = filters.length > 1 ? { $and: filters } : baseQuery;

  const [sellers, totalActiveCount, allActiveSellers] = await Promise.all([
    Seller.find(query).lean(),
    Seller.countDocuments(baseQuery),
    Seller.find(baseQuery)
      .select("_id createdAt category")
      .lean(),
  ]);

  const sellerIds = sellers.map((seller) => seller._id);
  const allActiveSellerIds = allActiveSellers.map((seller) => seller._id);

  const [ordersBySeller, productsBySeller, overallOrderStats] = await Promise.all([
    sellerIds.length
      ? Order.aggregate([
          { $match: { seller: { $in: sellerIds } } },
          {
            $group: {
              _id: "$seller",
              totalOrders: { $sum: 1 },
              deliveredOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
                },
              },
              pendingOrders: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["pending", "confirmed", "packed", "out_for_delivery"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", "delivered"] },
                    { $ifNull: ["$pricing.total", 0] },
                    0,
                  ],
                },
              },
              lastOrderAt: { $max: "$createdAt" },
            },
          },
        ])
      : Promise.resolve([]),
    sellerIds.length
      ? Product.aggregate([
          { $match: { sellerId: { $in: sellerIds } } },
          {
            $group: {
              _id: "$sellerId",
              productCount: { $sum: 1 },
              activeProductCount: {
                $sum: {
                  $cond: [{ $eq: ["$status", "active"] }, 1, 0],
                },
              },
            },
          },
        ])
      : Promise.resolve([]),
    allActiveSellerIds.length
      ? Order.aggregate([
          { $match: { seller: { $in: allActiveSellerIds } } },
          {
            $group: {
              _id: null,
              totalOrders: { $sum: 1 },
              totalRevenue: {
                $sum: {
                  $cond: [
                    { $eq: ["$status", "delivered"] },
                    { $ifNull: ["$pricing.total", 0] },
                    0,
                  ],
                },
              },
            },
          },
        ])
      : Promise.resolve([]),
  ]);

  const orderMap = new Map(ordersBySeller.map((row) => [String(row._id), row]));
  const productMap = new Map(productsBySeller.map((row) => [String(row._id), row]));

  const enrichedSellers = sellers.map((seller) => {
    const orderStats = orderMap.get(String(seller._id)) || {};
    const productStats = productMap.get(String(seller._id)) || {};
    const totalOrders = Number(orderStats.totalOrders || 0);
    const deliveredOrders = Number(orderStats.deliveredOrders || 0);
    const pendingOrders = Number(orderStats.pendingOrders || 0);
    const totalRevenue = Number(orderStats.totalRevenue || 0);
    const activeProductCount = Number(productStats.activeProductCount || 0);
    const productCount = Number(productStats.productCount || 0);
    const fulfillmentRate = totalOrders
      ? Math.round((deliveredOrders / totalOrders) * 100)
      : 0;
    const joinedAt = seller.reviewedAt || seller.createdAt || new Date();

    return {
      id: String(seller._id),
      _id: seller._id,
      shopName: seller.shopName || "Unnamed Store",
      ownerName: seller.name || "Unnamed Owner",
      email: seller.email || "",
      phone: seller.phone || "",
      category: seller.category || "General",
      status: seller.isVerified && seller.isActive ? "active" : "inactive",
      verificationStatus: seller.isVerified ? "verified" : "unverified",
      joinedAt,
      joinedDate: new Date(joinedAt).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      lastOrderAt: orderStats.lastOrderAt || null,
      lastOrderLabel: orderStats.lastOrderAt
        ? new Date(orderStats.lastOrderAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : "No orders yet",
      totalOrders,
      deliveredOrders,
      pendingOrders,
      totalRevenue,
      avgOrderValue: totalOrders ? totalRevenue / totalOrders : 0,
      fulfillmentRate,
      productCount,
      activeProductCount,
      serviceRadius: Number(seller.serviceRadius || 5),
      location: getSellerDisplayLocation(seller),
      city: seller.address || "Location not set",
      latitude: Array.isArray(seller.location?.coordinates)
        ? seller.location.coordinates[1] ?? null
        : null,
      longitude: Array.isArray(seller.location?.coordinates)
        ? seller.location.coordinates[0] ?? null
        : null,
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
        seller.shopName || seller.name || seller.email || "seller",
      )}`,
    };
  });

  const filteredSortedSellers = sortActiveSellerRows(enrichedSellers, sort);
  const total = filteredSortedSellers.length;
  const pagedItems = filteredSortedSellers.slice(skip, skip + limit);

  const totalRevenue = overallOrderStats[0]?.totalRevenue || 0;
  const totalOrders = overallOrderStats[0]?.totalOrders || 0;
  const newThisMonth = allActiveSellers.filter((seller) => {
    const createdAt = seller.createdAt ? new Date(seller.createdAt) : null;
    if (!createdAt) {
      return false;
    }

    const monthStart = new Date();
    monthStart.setHours(0, 0, 0, 0);
    monthStart.setDate(1);
    return createdAt >= monthStart;
  }).length;

  const highVolume = filteredSortedSellers.filter(
    (seller) => seller.totalOrders >= 100 || seller.totalRevenue >= 100000,
  ).length;

  const uniqueCategories = [
    ...new Set(
      allActiveSellers
        .map((seller) => seller.category)
        .filter(Boolean)
        .map((value) => String(value).trim()),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return {
    items: pagedItems,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalActiveSellers: totalActiveCount,
      totalOrders,
      totalRevenue,
      newThisMonth,
      highVolume,
      averageRevenuePerSeller: totalActiveCount ? totalRevenue / totalActiveCount : 0,
      averageOrdersPerSeller: totalActiveCount ? totalOrders / totalActiveCount : 0,
    },
    filters: {
      categories: uniqueCategories,
    },
  };
}

export async function getSellerOptions() {
  return Seller.find({})
    .select("_id shopName name email phone")
    .sort({ shopName: 1 })
    .lean();
}
