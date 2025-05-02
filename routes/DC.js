import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Recreate __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import express from "express";
import Bus from "../model/bus.js";
import Driver from "../model/driver.js";
import Conductor from "../model/conductor.js";

import multer from "multer";
import fs from "fs";
import path from "path";
import Complaint from "../model/complain.js";

let router = express.Router();

// Configure Multer
// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Resolve the absolute path to 'public/uploads' directory
    const uploadPath = join(__dirname, "..", "public", "uploads", "complains");

    // Check if the directory exists, if not, create it
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true }); // Create the uploads directory
    }

    // Set the directory where files should be stored
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const FileName = `${Date.now()}-${file.originalname}`;
    cb(null, FileName);
  },
});
const upload = multer({ storage: storage });
async function checkUserExistenceAndRedirect(req, res, next) {
  try {
    let worker;

    // Check if the user is a driver or conductor
    if (req.user.role === "driver") {
      worker = await Driver.findById(req.user.id); // Check for driver in the database
    } else if (req.user.role === "conductor") {
      worker = await Conductor.findById(req.user.id); // Check for conductor in the database
    }

    // If worker doesn't exist, clear cookies and redirect to login page
    if (!worker) {
      res.clearCookie("authToken"); // Clear the auth token cookie in case of error
      return res.redirect("/driverConductorLogin"); // Redirect to login page in case of error
    }
    req.worker = worker; // Store worker information in req.worker

    // If worker exists, proceed with the next middleware or route
    next();
  } catch (error) {
    console.error("Error checking user existence:", error);
    res.clearCookie("authToken"); // Clear the auth token cookie in case of error
    return res.redirect("/driverConductorLogin"); // Redirect to login page in case of error
  }
}

// Reusable function to fetch bus details based on user role
async function getBusDetailsByRole(role, userId) {
  try {
    let busQuery = {};

    if (role === "driver") {
      busQuery.driver = userId;
    } else if (role === "conductor") {
      busQuery.conductor = userId;
    }

    // Fetching bus details and populating driver and conductor information
    const bus = await Bus.findOneAndUpdate(busQuery)
      .populate("driver")
      .populate("conductor");

    return bus;
  } catch (error) {
    console.error("Error fetching bus details:", error);
    throw new Error("Could not fetch bus details");
  }
}

router.get("/", checkUserExistenceAndRedirect, async (req, res) => {
  return res.render("DC/index.ejs", { user: req.worker }); // Passing user as req.worker
});

router.get("/goLive", checkUserExistenceAndRedirect, async (req, res) => {
  try {
    // Checking the user role and fetching bus details accordingly
    const bus = await getBusDetailsByRole(req.user.role, req.user.id);

    if (bus) {
      return res.render("DC/goLive.ejs", { bus, user: req.worker }); // Passing user as req.worker
    } else {
      return res.status(404).json({
        message: "No bus assigned to this user.",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.get("/startStream", checkUserExistenceAndRedirect, async (req, res) => {
  try {
    // Checking the user role and fetching bus details accordingly
    const bus = await getBusDetailsByRole(req.user.role, req.user.id);

    if (bus) {
      return res.render("DC/stream.ejs", { bus, user: req.worker }); // Passing user as req.worker
    } else {
      return res.status(404).json({
        message: "No bus assigned to this user.",
      });
    }
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
});

router.post("/BlobStoring", async (req, res) => {});
router.get(
  "/registerComplain",
  checkUserExistenceAndRedirect,
  async (req, res) => {
    return res.render("DC/registerComplain.ejs", {
      user: req.worker,
      message: "",
    }); // Passing user as req.worker
  }
);
router.post(
  "/registerComplain",
  checkUserExistenceAndRedirect,
  upload.fields([
    { name: "media", maxCount: 1 }, // Accepts one image/video
    { name: "audio", maxCount: 1 }, // Accepts one audio
  ]),
  async (req, res) => {
    try {
      // Get Bus details by role (driver/conductor/etc.)
      const bus = await getBusDetailsByRole(req.user.role, req.user.id);

      // Get uploaded file names safely
      const mediaFile = req.files?.media ? req.files.media[0].filename : null;
      const audioFile = req.files?.audio ? req.files.audio[0].filename : null;

      // Create new complaint
      await Complaint.create({
        media: mediaFile,
        explanationAudio: audioFile,
        BusId: bus?._id || null,
        driverId: bus?.driverId || null,
        conductorId: bus?.conductorId || null,
      });

      // If success
      return res.render("DC/registerComplain.ejs", {
        user: req.worker,
        message: "Complaint has been registered successfully!",
      });
    } catch (err) {
      console.error(err);

      // If error
      return res.render("DC/registerComplain.ejs", {
        user: req.worker,
        message: "Server Error. Please try again later!",
      });
    }
  }
);

// The POST route to handle stream chunk uploads
router.post(
  "/saveStreamChunks",
  checkUserExistenceAndRedirect, // Middleware to check user existence and redirect if necessary
  upload.single("busStreamVideo"), // Handle the uploaded video file named 'busStreamVideo'
  async (req, res) => {
    console.log("hey i am in perfect working order ");
    try {
      // Get Bus details by user role (e.g., driver/conductor)
      const bus = await getBusDetailsByRole(req.user.role, req.user.id);

      if (!bus) {
        return res.status(404).json({ message: "Bus not found." });
      }

      // Check if the uploaded file exists
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }

      console.log(req.file);

      // Respond with success and uploaded file info
      return res.status(200).json({
        sucess: true,
        message: "Stream chunk saved successfully.",
        file: {
          filename: req.file.filename,

          size: req.file.size,
        },
      });
    } catch (error) {
      console.error("Error during file upload:", error);
      return res.status(500).json({ message: "Internal server error." });
    }
  }
);

router.get("/logout", (req, res) => {
  res.clearCookie("authToken"); // clear the correct cookie
  return res.redirect("/driverConductorLogin");
});
export { router as dcRouter };
