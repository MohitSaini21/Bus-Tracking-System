import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = (res, id, role) => {
  // Step 1: Create the JWT token
  // The payload is the user ID, which will be embedded inside the token.
  // The "Secret String" is the secret key used to sign the token, which ensures its integrity.
  const token = jwt.sign(
    { id, role }, // The payload containing the user's ID (this will be encoded in the token)
    "Secret String", // The secret key for signing the JWT token
    {
      expiresIn: "30d", // Token expiration time (1 hour here). You can adjust this as needed
    }
  );
  //   console.log(token)

  // Step 2: Set the token in a cookie
  // We're setting an HTTP-only cookie, meaning the client cannot directly access it via JavaScript.
  // This is a good security measure to prevent cross-site scripting (XSS) attacks.
  try {
    res.cookie("authToken", token, {
      httpOnly: true, // Make the cookie inaccessible to client-side JavaScript and it websites from the xxx attacks.
      secure: process.env.NODE_ENV === "production", // Ensure cookies are sent only over HTTPS in production
      sameSite: "Strict", // The cookie will only be sent to the same site (prevents CSRF attacks)
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  } catch (error) {
    console.log(`Knock Knock Error in Cookie ${error.mesage}`);
  }

  return token;
};
