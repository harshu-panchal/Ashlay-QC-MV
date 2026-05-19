import Seller from "../models/seller.js";
import Transaction from "../models/transaction.js";
import { handleResponse, calculateDistance } from "../utils/helper.js";
import mongoose from "mongoose";
import { invalidateSellerName } from "../services/entityNameCache.js";
import Wallet from "../models/wallet.js";
import {
  checkIdempotency,
  acquireIdempotencyLock,
  storeIdempotencyResult,
  storeIdempotencyError,
  releaseIdempotencyLock,
  isRetryableError,
  validateIdempotencyKey,
} from "../services/idempotencyService.js";

/* ===============================
   GET NEARBY SELLERS
================================ */
export const getNearbySellers = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return handleResponse(res, 400, "Latitude and longitude are required");
    }

    const customerLat = Number(lat);
    const customerLng = Number(lng);

    // Fetch all active/verified sellers
    // We could use $geoNear, but to strictly follow the requirement of individual radii,
    // we'll fetch sellers within a reasonable max distance (e.g. 100km) and then filter.
    const sellers = await Seller.find({
      isActive: true,
      isVerified: true,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [customerLng, customerLat],
          },
          $maxDistance: 100000, // 100km max search area for performance
        },
      },
    }).lean();

    // Filter based on individual service radius
    const nearbySellers = sellers.filter((seller) => {
      const sellerLng = seller.location.coordinates[0];
      const sellerLat = seller.location.coordinates[1];
      const distance = calculateDistance(
        customerLat,
        customerLng,
        sellerLat,
        sellerLng,
      );

      // Add distance to seller object for frontend
      seller.distance = distance;

      return distance <= (seller.serviceRadius || 5);
    });

    return handleResponse(
      res,
      200,
      "Nearby sellers fetched successfully",
      nearbySellers,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   REQUEST WITHDRAWAL (Seller)
================================ */
export const requestWithdrawal = async (req, res) => {
  try {
    const sellerId = req.user.id;
    const { amount, idempotencyKey } = req.body;

    if (!amount || amount <= 0) {
      return handleResponse(res, 400, "Please enter a valid amount");
    }

    if (idempotencyKey) {
      if (!validateIdempotencyKey(idempotencyKey)) {
        return handleResponse(res, 400, "Invalid idempotency key format");
      }
      const idempotencyCheck = await checkIdempotency(idempotencyKey, req.body);
      if (idempotencyCheck.exists && !idempotencyCheck.checksumMismatch) {
        if (idempotencyCheck.result.status === "error") {
          return handleResponse(res, idempotencyCheck.result.error.statusCode || 500, idempotencyCheck.result.error.message);
        }
        return handleResponse(res, 201, "Withdrawal request submitted successfully", idempotencyCheck.result.data);
      }
      if (idempotencyCheck.checksumMismatch) {
        return handleResponse(res, 422, "Idempotency key reused with different payload");
      }
      if (idempotencyCheck.inProgress) {
        return handleResponse(res, 409, "Request is being processed");
      }
      const lockAcquired = await acquireIdempotencyLock(idempotencyKey);
      if (!lockAcquired) {
        return handleResponse(res, 409, "Request is being processed");
      }
    }

    const session = await mongoose.startSession();
    let withdrawal;
    
    try {
      session.startTransaction();

      const wallet = await Wallet.findOne({ ownerType: 'SELLER', ownerId: sellerId }).session(session);
      const availableBalance = wallet ? wallet.availableBalance : 0;

      if (amount > availableBalance) {
        throw new Error(`Insufficient balance. Available: ₹${availableBalance}`);
      }

      // Deduct from available, maybe add to pendingPayouts? 
      // Legacy code doesn't adjust wallet here, but for optimistic concurrency we probably should debit wallet.
      // Wait, if the admin dashboard gets pendingPayouts from Transaction, we should just let Transaction be created.
      // However, if we don't debit wallet here, concurrent withdrawals could still pass if they read before the other withdrawal is processed.
      if (wallet) {
        wallet.availableBalance -= amount;
        // Optionally store in a new field or just rely on Transactions.
        await wallet.save({ session }); // This will throw VersionError if modified concurrently due to optimisticConcurrency
      }

      withdrawal = await Transaction.create([{
        user: sellerId,
        userModel: "Seller",
        type: "Withdrawal",
        amount: -Math.abs(amount),
        status: "Pending",
        reference: `WDR-${Date.now()}`,
      }], { session });

      withdrawal = withdrawal[0];
      await session.commitTransaction();
    } catch (error) {
      await session.abortTransaction();
      if (idempotencyKey) {
        if (isRetryableError(error)) {
          await releaseIdempotencyLock(idempotencyKey);
        } else {
          await storeIdempotencyError(idempotencyKey, error, req.body);
        }
      }
      if (error.name === 'VersionError') {
        return handleResponse(res, 409, "Concurrent transaction detected. Please try again.");
      }
      return handleResponse(res, 400, error.message);
    } finally {
      session.endSession();
    }

    if (idempotencyKey) {
      await storeIdempotencyResult(idempotencyKey, withdrawal, req.body);
    }

    return handleResponse(
      res,
      201,
      "Withdrawal request submitted successfully",
      withdrawal,
    );


  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   GET SELLER PROFILE
================================ */
export const getSellerProfile = async (req, res) => {
  try {
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }
    return handleResponse(
      res,
      200,
      "Seller profile fetched successfully",
      seller,
    );
  } catch (error) {
    return handleResponse(res, 500, error.message);
  }
};

/* ===============================
   UPDATE SELLER PROFILE
================================ */
export const updateSellerProfile = async (req, res) => {
  try {
    const { name, shopName, phone, address, locality, pincode, city, state, lat, lng, radius } = req.body;

    // Find seller
    const seller = await Seller.findById(req.user.id);
    if (!seller) {
      return handleResponse(res, 404, "Seller not found");
    }

    // Update fields if provided
    if (name) seller.name = name;
    if (shopName) seller.shopName = shopName;
    if (phone) seller.phone = phone;
    if (address !== undefined) seller.address = address;
    if (locality !== undefined) seller.locality = locality;
    if (pincode !== undefined) seller.pincode = pincode;
    if (city !== undefined) seller.city = city;
    if (state !== undefined) seller.state = state;

    // Validate and update geo data
    if (lat !== undefined && lng !== undefined) {
      if (lat < -90 || lat > 90)
        return handleResponse(res, 400, "Invalid latitude");
      if (lng < -180 || lng > 180)
        return handleResponse(res, 400, "Invalid longitude");

      seller.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

    if (radius !== undefined) {
      if (radius < 1 || radius > 100)
        return handleResponse(res, 400, "Radius must be between 1 and 100 km");
      seller.serviceRadius = Number(radius);
    }

    const updatedSeller = await seller.save();

    // Invalidate cached seller name in case shopName changed
    invalidateSellerName(req.user.id).catch((err) => {
      console.warn("[Seller] Name cache invalidation failed:", err.message);
    });

    return handleResponse(
      res,
      200,
      "Profile updated successfully",
      updatedSeller,
    );
  } catch (error) {
    // Handle duplicate phone error
    if (error.code === 11000) {
      return handleResponse(res, 400, "Phone number already in use");
    }
    return handleResponse(res, 500, error.message);
  }
};
