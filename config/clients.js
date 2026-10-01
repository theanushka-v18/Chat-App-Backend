export const DEFAULT_CLIENT_URL = "https://theanushka-chat-app.vercel.app";

export const allowedClientOrigins = [
  DEFAULT_CLIENT_URL,
  "http://localhost:5173",
];

const localClientOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];

export const resolveClientUrl = (req) => {
  const origin = req?.headers?.origin;

  if (origin && allowedClientOrigins.includes(origin)) {
    return origin;
  }

  if (origin && localClientOrigins.includes(origin)) {
    return origin;
  }

  return process.env.CLIENT_URL || DEFAULT_CLIENT_URL;
};