import Seller from "../models/seller.js";
import { calculateDistance } from "../utils/helper.js";
import { buildKey, getOrSet, getTTL } from "./cacheService.js";

const MAX_SELLER_SEARCH_DISTANCE_M = 100000;

export function parseCustomerCoordinates(query = {}) {
  const lat = Number(query.lat);
  const lng = Number(query.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { valid: false, lat: null, lng: null };
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return { valid: false, lat: null, lng: null };
  }

  return { valid: true, lat, lng };
}

/**
 * Round lat/lng to 4 decimal places (~11m precision) for cache key.
 * This groups nearby requests into the same cache bucket.
 */
function buildNearbySellersKey(lat, lng) {
  const rLat = Number(lat).toFixed(4);
  const rLng = Number(lng).toFixed(4);
  return buildKey("sellers", "nearby", `${rLat}:${rLng}`);
}

export async function getNearbySellerIdsForCustomer(lat, lng) {
  const fetchFn = async () => {
    // 1. Initial broad search for active sellers within 100km
    const sellers = await Seller.find({
      isActive: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [lng, lat],
          },
          $maxDistance: MAX_SELLER_SEARCH_DISTANCE_M,
        },
      },
    })
      .select("_id location serviceRadius")
      .lean();

    // 2. Filter strictly by each seller's specific service radius
    const strictlyNearby = sellers.filter((seller) => {
      const coords = seller?.location?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) return false;
      const [sellerLng, sellerLat] = coords;
      if (!Number.isFinite(sellerLat) || !Number.isFinite(sellerLng)) {
        return false;
      }
      const distanceKm = calculateDistance(lat, lng, sellerLat, sellerLng);
      return distanceKm <= (seller.serviceRadius || 5);
    });

    // 3. Fallback: If no sellers in strict radius, return the closest active sellers
    // We increase the search radius significantly (1000km) to ensure users see content during testing.
    if (!strictlyNearby.length && !sellers.length) {
      let globalSellers = await Seller.find({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [lng, lat],
            },
            $maxDistance: 1000000, // 1000km
          },
        },
      })
        .select("_id location serviceRadius")
        .limit(10)
        .lean();
      
      // 4. Extreme Fallback: If still no active sellers, check for ANY sellers (even inactive ones)
      // This is primarily for development/onboarding where the user hasn't activated their seller yet.
      if (!globalSellers.length) {
        globalSellers = await Seller.find({
          location: {
            $near: {
              $geometry: {
                type: "Point",
                coordinates: [lng, lat],
              },
              $maxDistance: 1000000,
            },
          },
        })
          .select("_id location serviceRadius")
          .limit(10)
          .lean();
      }
      
      return globalSellers.map((seller) => String(seller._id));
    }

    // If we have some sellers within 100km but none within their strict radius,
    // return those sellers anyway as a fallback.
    return sellers.slice(0, 10).map((seller) => String(seller._id));
  };

  return getOrSet(buildNearbySellersKey(lat, lng), fetchFn, getTTL("nearbySellers"));
}
