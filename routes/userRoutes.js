import express from "express";
import { uploadProfileImage } from "../controller/userController.js";
import { upload } from "../middlewares/uploadMiddleware.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

export const userRouter = express.Router();

userRouter.post(
  "/profile-image",
  authMiddleware,
  upload.single("profileImage"),
  uploadProfileImage,
);
