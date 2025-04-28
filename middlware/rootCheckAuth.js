import jwt from "jsonwebtoken";

export const checkAuth = (req, res, next) => {
  try {
    const token = req.cookies.authToken;

    if (token) {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "Secret String"
      );

      if (decoded) {
        req.user = decoded;

        return next(); // valid user, move to next
      }
    }

    // No token or invalid token
    return res.status(204).end(); // silent drop (no message)
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(204).end(); // silent drop
  }
};
