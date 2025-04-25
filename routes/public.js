import express from "express";
import Driver from "../model/driver.js";
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
  const { userId, password } = req.body;
  if (!userId || !password) {
  } else {
    const driver = await Driver.findOne({
      driverId: userId,
    });
    if (driver) {
      if (password == driver.password) {
        let token = generateTokenAndSetCookie(res, driver._id, driver.role);
        if (token) {
          return res.json({ role: "driver" });
        }
      }
    } else {
      const conductor = await Conductor.findOne({
        conductorId: userId,
      });
      if (conductor) {
        if (password == conductor.password) {
          let token = generateTokenAndSetCookie(
            res,
            conductor._id,
            conductor.role
          );
          if (token) {
            return res.json({ role: "conductor" });
          }
        }
      } else {
      }
    }
  }
});

router.get("/adminLogin", async (req, res) => {
  return res.render("public/adminLogin.ejs");
});

router.get("/administratorLogin", (req, res) => {
  return res.render("public/administratorLogin.ejs");
});
export { router as publicRouter };
