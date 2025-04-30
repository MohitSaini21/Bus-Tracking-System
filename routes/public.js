import express from "express";
import Driver from "../model/driver.js";
import CORE from "../model/admin.js";

import Conductor from "../model/conductor.js";
import Fuse from "fuse.js";
import Bus from "../model/bus.js";
import { checkAuthHome } from "../middlware/rootCheckHome.js";
import { generateTokenAndSetCookie } from "../utils/createJwtTokenSetCookie.js";
let router = express.Router();

router.get("/", (req, res) => {
  return res.render("public/index.ejs");
});

router.post("/", async (req, res) => {
  try {
    const userRoute = req.body.route?.toLowerCase().trim(); // normalize

    if (!userRoute) {
      return res.status(400).json({
        success: false,
        message: "Route is required.",
      });
    }

    // Step 1: Fetch all buses for each search
    const allBuses = await Bus.find(); // Move this inside the handler

    // Step 2: Configure Fuse.js with options
    const fuse = new Fuse(allBuses, {
      keys: ["route"], // We're searching in the 'route' field
      threshold: 0.3, // 0.0 = perfect match, 1.0 = complete mismatch
      includeScore: true, // This will include a score for each result
    });

    const fuzzyResults = fuse.search(userRoute); // Perform search

    // Step 3: Get the matching buses from the search results
    const matchingBuses = fuzzyResults.map((result) => result.item);

    if (matchingBuses.length > 0) {
      return res.json({
        success: true,
        data: matchingBuses,
      });
    } else {
      return res.json({
        success: false,
        message: "No buses found matching the route.",
      });
    }
  } catch (error) {
    console.error("Error searching buses:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
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

router.post("/adminLogin", checkAuthHome, async (req, res) => {
  let { userId, password } = req.body;
  userId = userId.trim();
  password = password.trim();

  if (!userId || !password || userId.length === 0 || password.length === 0) {
    return res.status(400).json({
      message:
        "Please fill out the form properly. Otherwise, you might get permanently blocked.",
    });
  }

  try {
    const user = await CORE.findOne({
      $or: [{ adminId: userId }, { administratorId: userId }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    if (user.password !== password) {
      return res.status(401).json({ message: "Incorrect password." });
    }

    // If password matched
    generateTokenAndSetCookie(res, user._id, user.role);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Error during admin login:", error);
    return res
      .status(500)
      .json({ message: "Something went wrong on the server." });
  }
});

export { router as publicRouter };
