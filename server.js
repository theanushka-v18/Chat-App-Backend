import express from "express";
import { createServer } from "http"; // ✅ for wrapping express
import { Server } from "socket.io"; // ✅ import socket.io properly
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";
import jwt from "jsonwebtoken";

import { authRouter } from "./routes/authRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import { Chat } from "./models/Chat.js";
import { allowedClientOrigins } from "./config/clients.js";
import { userRouter } from "./routes/userRoutes.js";
import { errorHandler } from "./middlewares/errorMiddleware.js";

dotenv.config();

const app = express();
const server = createServer(app); // ✅ create HTTP server

const allowedOrigins = allowedClientOrigins;

// Middlewares
app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true); // ✅ Allowed
      } else {
        callback(new Error("Not allowed by CORS")); // ❌ Blocked
      }
    },
    credentials: true,
  }),
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api", authRouter);
app.use("/api", chatRouter);
app.use("/api", userRouter);

// Error handler (must be last)
app.use(errorHandler);

// ✅ Initialize Socket.IO
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true); // ✅ Allowed
      } else {
        callback(new Error("Not allowed by CORS")); // ❌ Blocked
      }
    },
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// In-memory presence tracking: userId -> Set of socketIds
const onlineUsers = new Map();
const getOnlineUserIds = () => Array.from(onlineUsers.keys());

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error("Authentication error: missing token"));
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_SECRET);

    if (!decoded?.userId) {
      return next(new Error("Authentication error: invalid token"));
    }

    socket.data.userId = decoded.userId.toString();

    next();
  } catch (error) {
    // Distinguish common errors without leaking sensitive details
    if (error.name === "TokenExpiredError") {
      return next(new Error("Authentication error: token expired"));
    }
    if (error.name === "JsonWebTokenError") {
      return next(new Error("Authentication error: invalid token"));
    }
    return next(new Error("Authentication error"));
  }
});

// Socket.IO logic
io.on("connection", (socket) => {
  const userId = socket.data.userId;
  if (!userId) {
    return socket.disconnect(true);
  }

  // Join authenticated user's private room
  socket.join(userId);

  // Track presence
  const userSockets = onlineUsers.get(userId) || new Set();
  const wasOffline = userSockets.size === 0;
  userSockets.add(socket.id);
  onlineUsers.set(userId, userSockets);

  // Emit online transition if first active connection
  if (wasOffline) {
    // Broadcast online presence to all connected clients (authorized app users)
    io.emit("presence:online", { userId });
  }

  // Send initial presence snapshot to the connected client
  socket.emit("presence:initial", {
    online: getOnlineUserIds(),
  });

  socket.on("send_message", async (data) => {
    try {
      console.log("📩 New message:", data);

      // 1️⃣ Save message to DB - use authenticated userId to prevent impersonation
      const fromUserId = userId;
      const { toUserId, message, timestamp, senderName } = data;
      if (!toUserId || !message) {
        return;
      }
      const newMessage = new Chat({
        sender: new mongoose.Types.ObjectId(fromUserId),
        receiver: new mongoose.Types.ObjectId(toUserId),
        message: message,
        timestamp: timestamp || Date.now(),
        senderName: senderName,
      });

      await newMessage.save();

      // 2️⃣ Emit to receiver (sender will receive via their own room if needed, but receiver gets it)
      io.to(toUserId.toString()).emit("receive_message", newMessage);
      io.to(fromUserId.toString()).emit("receive_message", newMessage);
    } catch (error) {
      console.error("❌ Error saving message:", error);
    }
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    console.log(`✍️ User ${senderId} is typing to ${receiverId}`);
    io.to(receiverId).emit("typing", { senderId });
  });

  socket.on("stop_typing", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("stop_typing", { senderId });
  });

  socket.on("disconnect", () => {
    // Update presence tracking for this socket
    const userSockets = onlineUsers.get(userId);
    if (userSockets) {
      userSockets.delete(socket.id);
      if (userSockets.size === 0) {
        onlineUsers.delete(userId);
        // Emit offline transition when last active connection ends
        io.emit("presence:offline", { userId });
      }
      // If still has other connections, do not emit offline
    }
    console.log("❌ User disconnected:", socket.id);
  });
});

// Connect DB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
  })
  .catch((err) => {
    console.log("❌ Error connecting to MongoDB:", err);
  });

// ✅ Start server
server.listen(3000);
