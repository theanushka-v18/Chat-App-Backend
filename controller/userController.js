import { cloudinary } from "../config/cloudinary.js";
import { User } from "../models/User.js";
import { handleImageValidationSignature } from "../utils/imageValidation.js";

const uploadToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "chat-app/profile-images",
        resource_type: "image",
        // Re-encode the image server-side (strips malicious payloads/metadata)
        transformation: [{ width: 512, height: 512, crop: "limit" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );

    stream.end(buffer);
  });
};

export const uploadProfileImage = async (req, res, next) => {
  try {
    // Derive the user id from the auth middleware, never from the client
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const isValidImage = handleImageValidationSignature(
      req.file.buffer,
      req.file.mimetype,
    );

    if (!isValidImage) {
      return res.status(400).json({ message: "Invalid image file" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Upload the new image first
    const result = await uploadToCloudinary(req.file.buffer);

    const previousPublicId = user.profileImage?.publicId;

    try {
      user.profileImage = {
        url: result.secure_url,
        publicId: result.public_id,
      };
      await user.save();
    } catch (dbError) {
      // Avoid orphaned images: DB failed, so remove the newly uploaded asset
      if (result.public_id) {
        await cloudinary.uploader
          .destroy(result.public_id)
          .catch((err) => console.error("Cloudinary cleanup failed:", err));
      }
      throw dbError;
    }

    // Delete the previous asset only after the new one is safely saved
    if (previousPublicId && previousPublicId !== result.public_id) {
      await cloudinary.uploader
        .destroy(previousPublicId)
        .catch((err) => console.error("Previous image cleanup failed:", err));
    }

    return res.status(200).json({
      success: true,
      message: "Profile image updated successfully.",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profileImage: user.profileImage,
      },
    });
  } catch (error) {
    next(error);
  }
};
