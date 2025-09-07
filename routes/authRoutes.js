import express from "express";
import {
  changePassword,
  forgotPassword,
  login,
  logout,
  refresh,
  register,
  resetPassword,
} from "../controller/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const authRouter = express.Router();

authRouter.post("/register", register);
authRouter.post("/login", login);
authRouter.post("/refresh", refresh);
authRouter.post("/logout", logout);
authRouter.post("/change-password", authMiddleware, changePassword);
authRouter.post("/forgot-password", forgotPassword);
authRouter.post("/reset-password/:token", resetPassword);
