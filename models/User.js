import mongoose, { Schema } from "mongoose";

// Main User schema
const userSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  refreshToken: {
    type: String,
  },
  resetPasswordToken: {
    type: String,
  },
  resetPasswordExpire: { type: Date },
  profileImage: {
    url: { type: String },
    publicId: { type: String },
  },
  lastSeen: {
    type: Date,
    default: null,
  },
});

export const User = mongoose.model("User", userSchema);
