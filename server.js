import express from "express";
import { createServer } from "http"; // ✅ for wrapping express
import { Server } from "socket.io"; // ✅ import socket.io properly
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import cors from "cors";

import { authRouter } from "./routes/authRoutes.js";
import { chatRouter } from "./routes/chatRoutes.js";
import { Chat } from "./models/Chat.js";

dotenv.config();

const app = express();
const server = createServer(app); // ✅ create HTTP server

const allowedOrigins = [
  "https://theanushka-chat-app.vercel.app",
  "http://localhost:5173",
];

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
  })
);
app.use(express.json());
app.use(cookieParser());

// Routes
app.use("/api", authRouter);
app.use("/api", chatRouter);

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

// Socket.IO logic
io.on("connection", (socket) => {
  console.log("⚡ User connected:", socket.id);

  socket.on("join", (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined their room`);
  });

  socket.on("send_message", async (data) => {
    try {
      console.log("📩 New message:", data);

      // 1️⃣ Save message to DB
      const newMessage = new Chat({
        sender: new mongoose.Types.ObjectId(data.fromUserId),
        receiver: new mongoose.Types.ObjectId(data.toUserId),
        message: data.message,
        timestamp: data.timestamp || Date.now(),
        senderName: data.senderName,
      });

      await newMessage.save();

      // 2️⃣ Emit to both sender and receiver rooms
      // io.to(data.fromUserId).emit("receive_message", newMessage);
      io.to(data.toUserId).emit("receive_message", newMessage);
    } catch (error) {
      console.error("❌ Error saving message:", error);
    }
  });

  socket.on("typing", ({ senderId, receiverId }) => {
    io.to(receiverId).emit("typing", { senderId });
  });

  socket.on('stop_typing', ({senderId, receiverId}) => {
    io.to(receiverId).emit('stop_typing', {senderId})
  })

  socket.on("disconnect", () => {
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
