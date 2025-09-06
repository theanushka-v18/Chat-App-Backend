import express from "express";
import { getChatHistory, getUsers } from "../controller/chatController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const chatRouter = express.Router();

chatRouter.post("/users", authMiddleware, getUsers);
chatRouter.post("/chat-history", authMiddleware, getChatHistory);
