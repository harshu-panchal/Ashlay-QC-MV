/**
 * Socket.IO — order rooms, role rooms, JWT auth.
 */
import { verifySocketToken } from "./socketAuth.js";
import mongoose from "mongoose";
import Ticket from "../models/ticket.js";
import Order from "../models/order.js";

let _io = null;

const deliverySockets = new Map();
const userSockets = new Map(); // Map<userId, Set<socketId>>

export const initSocket = (io) => {
  _io = io;

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      null;
    if (!token) {
      socket.user = null;
      return next();
    }
    const user = verifySocketToken(token);
    if (!user) {
      return next(new Error("Unauthorized"));
    }
    socket.user = user;
    next();
  });

  io.on("connection", (socket) => {
    const { id: userId, role } = socket.user || {};
    if (!userId) {
      return;
    }

    const uIdStr = userId.toString();

    // Track user sockets
    if (!userSockets.has(uIdStr)) {
      userSockets.set(uIdStr, new Set());
    }
    userSockets.get(uIdStr).add(socket.id);

    if (role === "delivery") {
      deliverySockets.set(uIdStr, socket.id);
      socket.join("delivery:online");
      socket.join(`delivery:${uIdStr}`);
    }
    if (role === "seller") {
      socket.join(`seller:${uIdStr}`);
    }
    if (role === "customer" || role === "user") {
      socket.join(`customer:${uIdStr}`);
    }
    if (role === "admin") {
      socket.join("admin:orders");
      socket.join("admin:support");
    }

    socket.on("join_order", async (orderId) => {
      const raw = typeof orderId === "string" ? orderId.trim() : "";
      if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return;

      if (role === "admin") {
        socket.join(`order:${raw}`);
        return;
      }

      try {
        const order = await Order.findById(raw).select("customerId sellerId deliveryBoyId").lean();
        if (!order) return;

        const isAuthorized = 
          (role === "customer" && order.customerId?.toString() === uIdStr) ||
          (role === "seller" && order.sellerId?.toString() === uIdStr) ||
          (role === "delivery" && order.deliveryBoyId?.toString() === uIdStr);

        if (isAuthorized) {
          socket.join(`order:${raw}`);
        }
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_order", (orderId) => {
      if (!orderId) return;
      socket.leave(`order:${String(orderId).trim()}`);
    });

    socket.on("join_ticket", async (ticketId) => {
      const raw = typeof ticketId === "string" ? ticketId.trim() : "";
      if (!raw || !mongoose.Types.ObjectId.isValid(raw)) return;

      if (role === "admin") {
        socket.join(`ticket:${raw}`);
        return;
      }

      try {
        const ticket = await Ticket.findById(raw).select("userId").lean();
        if (!ticket?.userId) return;
        if (ticket.userId.toString() !== uIdStr) return;
        socket.join(`ticket:${raw}`);
      } catch {
        /* ignore */
      }
    });

    socket.on("leave_ticket", (ticketId) => {
      if (!ticketId) return;
      socket.leave(`ticket:${String(ticketId).trim()}`);
    });

    socket.on("register_delivery", (deliveryId) => {
      if (deliveryId && role === "delivery" && deliveryId.toString() === uIdStr) {
        deliverySockets.set(uIdStr, socket.id);
      }
    });

    socket.on("disconnect", () => {
      // Clean up user sockets
      const userSids = userSockets.get(uIdStr);
      if (userSids) {
        userSids.delete(socket.id);
        if (userSids.size === 0) {
          userSockets.delete(uIdStr);
        }
      }

      // Clean up delivery sockets
      if (role === "delivery" && deliverySockets.get(uIdStr) === socket.id) {
        deliverySockets.delete(uIdStr);
      }
    });
  });
};

export const getIO = () => {
  if (!_io) throw new Error("Socket.IO not initialized");
  return _io;
};

export const notifyDeliveryPartners = (orderData) => {
  if (!_io) return;
  _io.to("delivery:online").emit("new_order_packed", orderData);
};
