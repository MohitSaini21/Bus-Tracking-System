import express from "express";
import Driver from "../model/driver.js";
import CORE from "../model/admin.js";
import rateLimit from "express-rate-limit";

import Conductor from "../model/conductor.js";
import Fuse from "fuse.js";
import Bus from "../model/bus.js";
import { checkAuthHome } from "../middlware/rootCheckHome.js";
import { generateTokenAndSetCookie } from "../utils/createJwtTokenSetCookie.js";
let router = express.Router();

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 5, // max 5 requests per window
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers (optional)

  handler: (req, res) => {
    // The rateLimit middleware attaches a property `rateLimit` to the request with info
    // But to be safe, calculate manually:

    const retryAfterMs = req.rateLimit?.resetTime
      ? req.rateLimit.resetTime - Date.now()
      : 0;

    const secondsLeft = Math.ceil(retryAfterMs / 1000);

    res.status(429).json({
      success: false,
      error: "Too many requests",
      message: `You have exceeded the allowed number of login attempts. Please try again after ${secondsLeft} seconds.`,
      retryAfter: secondsLeft,
      code: 429,
    });
  },
});

router.get("/", (req, res) => {
  return res.render("public/index.ejs");
});

router.post("/", async (req, res) => {
  try {
    const busNumber = req.body.inputValue?.toLowerCase().trim();

    if (!busNumber) {
      return res.status(400).json({
        success: false,
        message: "busNumber is required.",
      });
    }

    // Case-insensitive exact match
    const bus = await Bus.findOne({
      busNumber: { $regex: new RegExp(`^${busNumber}$`, "i") },
    });

    if (bus) {
      return res.json({
        success: true,
        data: bus,
      });
    } else {
      return res.json({
        success: false,
        message: "No matching bus found.",
      });
    }
  } catch (error) {
    console.error("Error searching bus:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong.",
    });
  }
});

router.get("/particularBus/:id", async (req, res) => {
  const { id } = req.params;
  const bus = await Bus.findById(id);
  if (bus) {
    return res.render("public/particularBus.ejs", { bus });
  }
});

router.get("/locationBus/:id", async (req, res) => {
  const { id } = req.params;
  const bus = await Bus.findById(id);
  if (bus) {
    return res.render("public/locationBus.ejs", { bus });
  }
});

router.get("/driverConductorLogin", checkAuthHome, async (req, res) => {
  return res.render("public/dcLogin.ejs");
});
router.post("/driverConductorLogin", checkAuthHome, async (req, res) => {
  try {
    // Trim user input to remove unnecessary spaces
    const { userId, password } = req.body;

    // Check if userId or password is missing
    if (!userId || !password) {
      return res.status(400).json({
        message:
          "Please fill out the form properly. Otherwise, you might get permanently blocked.",
      });
    }

    // Trim any leading or trailing spaces
    const trimmedUserId = userId.trim();
    const trimmedPassword = password.trim();

    // Look for the driver first
    let driver = await Driver.findOne({ driverId: trimmedUserId });
    if (driver) {
      if (trimmedPassword === driver.password) {
        const token = generateTokenAndSetCookie(res, driver._id, driver.role);
        if (token) {
          return res.status(200).json({ success: true });
        }
      } else {
        return res
          .status(401)
          .json({ message: "Incorrect password for driver" });
      }
    } else {
      // If driver not found, check for the conductor
      let conductor = await Conductor.findOne({ conductorId: trimmedUserId });
      if (conductor) {
        if (trimmedPassword === conductor.password) {
          const token = generateTokenAndSetCookie(
            res,
            conductor._id,
            conductor.role
          );
          if (token) {
            return res.status(200).json({ success: true });
          }
        } else {
          return res
            .status(401)
            .json({ message: "Incorrect password for conductor" });
        }
      } else {
        return res.status(404).json({
          message:
            "Warning: This account is not registered as a driver or conductor. Unauthorized access attempt detected. Please contact support if this is a mistake.",
        });
      }
    }
  } catch (error) {
    console.error("Error during login:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong, please try again later" });
  }
});

router.get("/coreLogin", checkAuthHome, async (req, res) => {
  return res.render("public/coreLogin.ejs");
});

router.post("/adminLogin", checkAuthHome, limiter, async (req, res) => {
  let { userId, password } = req.body;
  userId = userId.trim();
  password = password.trim();

  // Validation: Check if both fields are filled
  if (!userId || !password || userId.length === 0 || password.length === 0) {
    return res.status(400).json({
      success: false,
      message:
        "Please complete all required fields before submitting the form.",
    });
  }

  try {
    // Attempt to find admin by ID
    const user = await CORE.findOne({
      $or: [{ adminId: userId }, { administratorId: userId }],
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "No matching administrator account was found. Please verify your credentials.",
      });
    }

    // Compare passwords (this should ideally use bcrypt, not plain comparison)
    if (user.password !== password) {
      return res.status(401).json({
        success: false,
        message: "The credentials provided are incorrect. Please try again.",
      });
    }

    // Success: Issue token and return
    generateTokenAndSetCookie(res, user._id, user.role);

    return res.status(200).json({
      success: true,
      message: "Login successful. Redirecting to your dashboard...",
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "An internal server error occurred. Please try again later.",
    });
  }
});

export { router as publicRouter };
