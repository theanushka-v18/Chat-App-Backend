import { User } from "../models/User.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import crypto from "crypto";

dotenv.config();

const generateAccessToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_SECRET, { expiresIn: "30m" });
};

const generateRefreshToken = (userId) => {
  return jwt.sign({ userId }, process.env.REFRESH_SECRET, { expiresIn: "7d" });
};

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // check if user already exists
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    // hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // save user
    const user = new User({ name, email, password: hashedPassword });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // will change it later
      sameSite: "strict",
    });

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email },
      message: "User registered sucessfully",
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false, // will change it later
      sameSite: "strict",
    });

    res.json({
      accessToken,
      user: { id: user._id, name: user.name, email: user.email },
      message: "User logged in successfully",
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).json({ message: error.message });
  }
};

export const refresh = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;

    if (!token) return res.status(401).json({ message: "No refresh token" });

    const user = await User.findOne({ refreshToken: token });

    if (!user)
      return res.status(403).json({ message: "Invalid refresh token" });

    jwt.verify(token, process.env.REFRESH_SECRET, (err, decoded) => {
      if (err)
        return res.status(403).json({ message: "Invalid refresh token" });

      const newAccessToken = generateAccessToken(decoded.userId);
      res.json({ accessToken: newAccessToken });
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.cookies.refreshToken;
    if (!token) return res.sendStatus(204);

    const user = await User.findOne({ refreshToken: token });

    if (user) {
      user.refreshToken = null;
      await user.save();
    }
    res.clearCookie("refreshToken");
    res.json({ message: "Logged out successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: "User not found" });

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch)
      return res.status(400).json({ message: "Current password is incorrect" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;

    await user.save();

    res.status(200).json({ message: "Password updated successfully, login again" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    // generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpire = resetTokenExpire;

    await user.save();

    // Determine client URL dynamically
    const clientUrl = process.env.CLIENT_URL || req.headers.origin || "https://theanushka-chat-app.vercel.app";
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    // 1. Try Resend HTTP API (Uses Port 443 HTTPS - Works on Render Free Tier!)
    if (process.env.RESEND_API_KEY) {
      try {
        const resendRes = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "Chat App <onboarding@resend.dev>",
            to: [user.email],
            subject: "Chat App - Password reset",
            html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 10 minutes.</p>`,
          }),
        });

        const resendData = await resendRes.json();
        if (!resendRes.ok) {
          console.error("❌ Resend API Error:", resendData);
          return res.status(500).json({ message: resendData.message || "Failed to send email via Resend API" });
        }

        return res.status(200).json({ message: "Reset link has been sent to email" });
      } catch (resendErr) {
        console.error("❌ Resend fetch error:", resendErr);
      }
    }

    // 2. Fallback to Nodemailer SMTP (For localhost or environments allowing SMTP ports)
    if (!process.env.USER_EMAIL || !process.env.EMAIL_PASS) {
      console.error("❌ No email provider configured. Please set RESEND_API_KEY or USER_EMAIL/EMAIL_PASS in environment variables.");
      return res.status(500).json({ message: "Email configuration is missing on server. Set RESEND_API_KEY or USER_EMAIL & EMAIL_PASS." });
    }

    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true, // SSL/TLS
      auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.EMAIL_PASS,
      },
      connectionTimeout: 8000, // 8 second timeout for cloud environments blocking SMTP
      greetingTimeout: 8000,
      socketTimeout: 8000,
    });

    await transporter.sendMail({
      from: `"Chat App" <${process.env.USER_EMAIL}>`,
      to: user.email,
      subject: "Chat App - Password reset",
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. Link expires in 10 minutes.</p>`,
    });

    res.status(200).json({ message: "Reset link has been sent to email" });
  } catch (error) {
    console.error("❌ Error in forgotPassword:", error);
    const errorMsg = error.code === "ETIMEDOUT" || error.code === "ECONNREFUSED" || error.message?.includes("greeting") 
      ? "Email server connection timed out. If hosted on Render Free Tier, outbound SMTP ports (465/587) are blocked. Please add RESEND_API_KEY to server environment variables."
      : error.message;
    res.status(500).json({ message: errorMsg });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const token = req.params.token || req.body.token;
    const { newPassword } = req.body;

    if (!token) {
      return res.status(400).json({ message: "Reset token is required" });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpire: { $gt: Date.now() }, // not expired
    });

    if (!user)
      return res.status(400).json({ message: "Invalid or expired token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successful, login again" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
