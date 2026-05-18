import mongoose from "mongoose";
import Delivery from "../../models/delivery.js";
import Transaction from "../../models/transaction.js";
import Notification from "../../models/notification.js";

export async function getDeliveryCashBalancesData({ page, limit, skip }) {
  const ridersPipeline = [
    {
      $lookup: {
        from: "transactions",
        let: { deliveryBoyId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$user", "$$deliveryBoyId"] } } },
          {
            $group: {
              _id: null,
              currentCash: {
                $sum: {
                  $cond: [
                    { $eq: ["$type", "Cash Collection"] },
                    "$amount",
                    {
                      $cond: [
                        { $eq: ["$type", "Cash Settlement"] },
                        { $subtract: [0, { $abs: "$amount" }] },
                        0
                      ]
                    }
                  ]
                }
              },
              lastSettlementDate: {
                $max: {
                  $cond: [{ $eq: ["$type", "Cash Settlement"] }, "$createdAt", null]
                }
              }
            }
          }
        ],
        as: "txnStats",
      },
    },
    {
      $lookup: {
        from: "orders",
        let: { deliveryBoyId: "$_id" },
        pipeline: [
          { $match: { $expr: { $eq: ["$deliveryBoy", "$$deliveryBoyId"] } } },
          {
            $group: {
              _id: null,
              pendingOrders: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $in: ["$status", ["confirmed", "packed", "picked_up", "out_for_delivery"]] },
                        { $in: ["$payment.method", ["cash", "cod"]] }
                      ]
                    },
                    1,
                    0
                  ]
                }
              },
              totalOrders: {
                $sum: {
                  $cond: [{ $eq: ["$status", "delivered"] }, 1, 0]
                }
              }
            }
          }
        ],
        as: "orderStats",
      },
    },
    {
      $addFields: {
        txnStats: { $arrayElemAt: ["$txnStats", 0] },
        orderStats: { $arrayElemAt: ["$orderStats", 0] },
      }
    },
    {
      $project: {
        id: "$_id",
        name: 1,
        phone: 1,
        avatar: {
          $cond: [
            { $ifNull: ["$documents.profileImage", false] },
            "$documents.profileImage",
            {
              $concat: [
                "https://api.dicebear.com/7.x/avataaars/svg?seed=",
                { $ifNull: ["$name", "Delivery"] }
              ],
            },
          ],
        },
        currentCash: { $ifNull: ["$txnStats.currentCash", 0] },
        limit: { $ifNull: ["$limit", 5000] },
        pendingOrders: { $ifNull: ["$orderStats.pendingOrders", 0] },
        totalOrders: { $ifNull: ["$orderStats.totalOrders", 0] },
        lastSettlement: { $ifNull: ["$txnStats.lastSettlementDate", "Never"] },
      },
    },
    {
      $addFields: {
        status: {
          $cond: [
            { $gt: ["$currentCash", 4500] },
            "critical",
            {
              $cond: [
                { $gt: ["$currentCash", 3000] },
                "warning",
                "safe",
              ],
            },
          ],
        }
      }
    },
    {
      $facet: {
        meta: [{ $count: "total" }],
        items: [{ $skip: skip }, { $limit: limit }],
      },
    },
  ];

  const [aggregateResult] = await Delivery.aggregate(ridersPipeline);
  const meta = aggregateResult?.meta?.[0];
  const riders = aggregateResult?.items ?? [];
  const total = meta?.total ?? 0;

  const totalInHand = riders.reduce(
    (accumulator, rider) => accumulator + (rider.currentCash || 0),
    0,
  );
  const overLimitCount = riders.filter(
    (rider) => (rider.currentCash || 0) >= (rider.limit || 5000),
  ).length;

  return {
    items: riders,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
    stats: {
      totalInHand,
      overLimitCount,
      avgBalance: riders.length ? totalInHand / riders.length : 0,
    },
  };
}

export async function settleRiderCashEntry({ riderId, amount, method, reference }) {
  if (!riderId || !amount || amount <= 0) {
    throw new Error("Missing riderId or invalid amount");
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const txnReference = reference || `CSH-SET-${riderId}-${Date.now()}`;
    const existingTxn = await Transaction.findOne({ reference: txnReference }).session(session);
    if (existingTxn) {
      await session.abortTransaction();
      return existingTxn;
    }

    const rider = await Delivery.findById(riderId).session(session);
    if (!rider) {
      await session.abortTransaction();
      return null;
    }

    const [settlement] = await Transaction.create(
      [
        {
          user: riderId,
          userModel: "Delivery",
          type: "Cash Settlement",
          amount: -Math.abs(amount),
          status: "Settled",
          reference: txnReference,
          notes: `Method: ${method || "Cash"}`,
        },
      ],
      { session },
    );

    await Notification.create(
      [
        {
          recipient: riderId,
          recipientModel: "Delivery",
          title: "Cash Settled",
          message: `Admin has collected \u20B9${amount} cash from you. Your balance is updated.`,
          type: "payment",
          data: { transactionId: settlement._id },
        },
      ],
      { session },
    );

    await session.commitTransaction();
    return settlement;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

export async function getRiderCashDetailsData(riderId) {
  const transactions = await Transaction.find({
    user: riderId,
    userModel: "Delivery",
    type: "Cash Collection",
  })
    .populate("order", "orderId pricing createdAt")
    .sort({ createdAt: -1 })
    .limit(20);

  return transactions.map((transaction) => ({
    id: transaction.order?.orderId || transaction.reference || "N/A",
    amount: transaction.amount,
    time: new Date(transaction.createdAt).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: transaction.createdAt,
  }));
}

export async function getCashSettlementHistoryData({ page, limit, skip }) {
  const query = { userModel: "Delivery", type: "Cash Settlement" };

  const [history, total] = await Promise.all([
    Transaction.find(query)
      .populate("user", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transaction.countDocuments(query),
  ]);

  const items = history.map((entry) => ({
    id: (entry.reference || entry._id).toString(),
    rider: entry.user?.name || "Unknown Rider",
    amount: Math.abs(entry.amount),
    date: entry.createdAt,
    method: entry.notes?.replace("Method: ", "") || "Cash Submission",
    status: "completed",
  }));

  return {
    items,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit) || 1,
  };
}
