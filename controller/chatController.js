import { Chat } from "../models/Chat.js";
import { User } from "../models/User.js";

export const getUsers = async (req, res) => {
  try {
    const { name } = req.body;
    const allUsers = await User.find({}, "-password -refreshToken");
    const requiredUsers = allUsers?.filter((user) => {
      return user.name !== name;
    });
    res.status(200).json(requiredUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getChatHistory = async (req, res) => {
  try {
    const { fromUserId, toUserId } = req.body;
    const chats = await Chat.find({
      $or: [
        { sender: fromUserId, receiver: toUserId },
        { sender: toUserId, receiver: fromUserId },
      ],
    }).sort({ timestamp: 1 });

    res.status(200).json({
      chats: chats,
      message: "Chat history recieved successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
