import multer from "multer";

const multerMessages = {
  LIMIT_FILE_SIZE: "File too large. Maximum size is 5MB.",
  LIMIT_FILE_COUNT: "Too many files uploaded.",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field.",
  LIMIT_FIELD_COUNT: "Too many fields.",
  LIMIT_PART_COUNT: "Too many parts.",
};

export const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: multerMessages[err.code] || err.message,
      code: err.code,
    });
  }

  const status = err.status || err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message || "Internal server error",
  });
};
