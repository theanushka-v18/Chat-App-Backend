import mongoose, { Schema } from "mongoose";

const messageSchema = new Schema({
  sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
  receiver: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  senderName: { type: String, required: true },
});

export const Chat = mongoose.model("Chat", messageSchema);
