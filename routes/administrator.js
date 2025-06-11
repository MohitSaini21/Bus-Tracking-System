import express from "express";
import CORE from "../model/admin.js";

import Bus from "../model/bus.js";
import Driver from "../model/driver.js";
import Conductor from "../model/conductor.js";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v4 as uuidv4 } from "uuid";
import generatePassword from "../utils/password.js";
import { rewind } from "@turf/turf";
import { create } from "domain";

let router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, "..", "public", "uploads");

    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const FileName = `${Date.now()}-${file.originalname}`;
    cb(null, FileName);
  },
});
const upload = multer({ storage: storage });

router.get("/addBus", async (req, res) => {
  const user = await CORE.findById(req.user.id);
  if (!user) {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
  res.render("administrator/addBus.ejs", { user });
});

router.post("/addBus", async (req, res) => {
  const formDataArray = req.body; // The array of objects that was sent in the request body

  // Separate data by type
  const busData = formDataArray.find((item) => item.type === "bus");
  const driverData = formDataArray.find((item) => item.type === "driver");
  const conductorData = formDataArray.find((item) => item.type === "conductor");

  // Initialize variables for the driver and conductor IDs
  let driverDocId = null;
  let conductorDocId = null;
  let busDocId = null;

  console.log(driverData);
  console.log(conductorData);

  try {
    if (driverData) {
      // Create a new driver
      const newDriver = await Driver.create({
        driverId: uuidv4(),
        name: driverData.data.driverName, // Fix variable name mismatch
        phone: driverData.data.driverPhone, // Fix variable name mismatch
        licenseNumber: driverData.data.driverLicenseNumber, // Fix variable name mismatch
        address: driverData.data.driverAddress, // Fix variable name mismatch
        joiningDate: driverData.data.DriverJoiningDate,
        password: generatePassword(8),
        status: "Active", // Default status
        profilePhoto: "/assets/images/faces/driver.png",
      });

      driverDocId = newDriver._id; // Store the driver's ID
      console.log("Driver created successfully:", newDriver);
    }

    if (conductorData) {
      // Create a new conductor
      const newConductor = await Conductor.create({
        conductorId: uuidv4(),
        name: conductorData.data.conductorName, // Fix variable name mismatch
        phone: conductorData.data.conductorPhone, // Fix variable name mismatch
        address: conductorData.data.conductorAddress, // Fix variable name mismatch
        joiningDate: conductorData.data.conductorJoiningDate,
        status: "Active", // Default status
        password: generatePassword(8),
        profilePhoto: "/assets/images/faces/conductor.jpg",
      });

      conductorDocId = newConductor._id; // Store the conductor's ID
      console.log("Conductor created successfully:", newConductor);
    }

    if (busData) {
      // Extract bus data
      const {
        busNumber,
        route,
        capacity,
        status,
        fuelType,
        lastServiced,
        stops,
        averageSpeed,
        distanceTravelled,
      } = busData.data; // Access actual bus data

      // Create a new bus
      const newBus = await Bus.create({
        busNumber,
        route,
        capacity,
        status,
        fuelType,
        lastServiced,
        routeStops: stops, // Storing route stops
        busDocuments: [], // You can add bus documents if you have them
        driver: driverDocId, // Add the driver's ID to the bus
        conductor: conductorDocId, // Add the conductor's ID to the bus
        averageSpeed,
        distanceTravelled,
      });

      busDocId = newBus._id; // Store the bus's ID
      console.log("Bus created successfully:", newBus);

      // Update the driver and conductor with the bus ID
      await Driver.findByIdAndUpdate(driverDocId, {
        assignedBus: busDocId, // Assign the bus to the driver
      });

      await Conductor.findByIdAndUpdate(conductorDocId, {
        assignedBus: busDocId, // Assign the bus to the conductor
      });
    }

    // Respond with a success message
    return res.json({
      message: "Bus, Driver, and Conductor created and assigned successfully.",
    });
  } catch (error) {
    console.error("Error occurred:", error);
    return res
      .status(500)
      .json({ message: "Error processing data", error: error.message });
  }
});

router.get("/conductorDriver", async (req, res) => {
  const user = await CORE.findById(req.user.id);
  if (!user) {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
  let { driverId = "N/A", conductorId = "N/A" } = req.query;

  // ✅ Driver ID valid hai → Process karo
  if (driverId !== "N/A") {
    try {
      const driver = await Driver.findById(driverId);
      if (driver) {
        // console.log(driver);
        return res.render("administrator/conDriver.ejs", {
          worker: driver,
          user,
        });
      }
    } catch (error) {
      return; // ❌ No response → Hacker ko kuch bhi leak nahi hoga
    }
  }

  // ✅ Conductor ID valid hai → Process karo
  if (conductorId !== "N/A") {
    try {
      const conductor = await Conductor.findById(conductorId);
      if (conductor) {
        // console.log(conductor);
        return res.render("administrator/conDriver.ejs", {
          worker: conductor,
          user,
        });
      }
    } catch (error) {
      return; // ❌ No response → Hacker ko kuch bhi leak nahi hoga
    }
  }

  // 🚨 Invalid request → No response (silently ignore)
  return;
});

// Conductor Related End paths

router.post("/conductorDocuments/:id", upload.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const { paperNames } = req.body;
    const files = req.files;

    console.log(files);
    // Find the conductor and update its documents
    const conductor = await Conductor.findById(id);
    if (!conductor) {
      return res.status(404).json({ message: "Conductor not found" });
    }
    if (files.length == 0) {
      return res.redirect(
        `/tmu/administrator/settings/conductorDriver?conductorId=${conductor._id}`
      );
    }

    const documentNames = Array.isArray(paperNames) ? paperNames : [paperNames];
    console.log(documentNames);

    // Creating an array of document objects
    const documents = files.map((file, index) => ({
      name: documentNames[index] || "Unknown Document", // Default if name is missing
      url: file.path, // File path
    }));

    conductor.conductorDocuments.push(...documents);
    await conductor.save();

    res.redirect(
      `/tmu/administrator/settings/conductorDriver?conductorId=${conductor._id}`
    );
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post(
  "/conductor/profileImage/:id",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Fetch conductor by ID
      const conductor = await Conductor.findById(id);
      if (!conductor) {
        return res.status(404).json({ message: "Conductor not found" });
      }

      // Update profile
      const fullPath = req.file.path;
      const relativePath = fullPath.split("public")[1];
      conductor.profilePhoto = relativePath;
      await conductor.save();

      console.log("File uploaded:", req.file);

      // Redirect user after successful upload
      res.redirect(
        `/tmu/administrator/settings/conductorDriver?conductorId=${conductor._id}`
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post("/conductorRow/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // Get all fields from req.body

    // Fetch conductor by ID and update
    const conductor = await Conductor.findByIdAndUpdate(id, updateData, {
      new: true, // Returns updated document
      runValidators: true, // Ensures validation rules are applied
    });

    if (!conductor) {
      return res.status(404).json({ message: "Conductor not found" });
    }

    res.redirect(
      `/tmu/administrator/settings/conductorDriver?conductorId=${conductor._id}`
    );
  } catch (error) {
    console.error("Error updating conductor:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Driver Related End Point

router.post("/driverDocuments/:id", upload.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const { paperNames } = req.body;
    const files = req.files;

    const documentNames = Array.isArray(paperNames) ? paperNames : [paperNames];

    // Creating an array of document objects
    const documents = files.map((file, index) => ({
      name: documentNames[index] || "Unknown Document", // Default if name is missing
      url: file.path, // File path
    }));

    // Find the conductor and update its documents
    const conductor = await Driver.findById(id);
    if (!conductor) {
      return res.status(404).json({ message: "Conductor not found" });
    }

    conductor.driverDocuments.push(...documents);
    await conductor.save();

    res.redirect(
      `/tmu/administrator/settings/conductorDriver?driverId=${conductor._id}`
    );
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post(
  "/driver/profileImage/:id",
  upload.single("profileImage"),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Fetch conductor by ID
      const conductor = await Driver.findById(id);
      if (!conductor) {
        return res.status(404).json({ message: "Conductor not found" });
      }

      // Update profile
      const fullPath = req.file.path;
      const relativePath = fullPath.split("public")[1];
      conductor.profilePhoto = relativePath;
      await conductor.save();

      console.log("File uploaded:", req.file);

      // Redirect user after successful upload
      res.redirect(
        `/tmu/administrator/settings/conductorDriver?driverId=${conductor._id}`
      );
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }
);

router.post("/driverRow/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body; // Get all fields from req.body

    // Fetch conductor by ID and update
    const conductor = await Driver.findByIdAndUpdate(id, updateData, {
      new: true, // Returns updated document
      runValidators: true, // Ensures validation rules are applied
    });

    if (!conductor) {
      return res.status(404).json({ message: "Conductor not found" });
    }

    res.redirect(
      `/tmu/administrator/settings/conductorDriver?driverId=${conductor._id}`
    );
  } catch (error) {
    console.error("Error updating conductor:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Bus Related Route

router.get("/busEntire/:id", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);
    if (!user) {
      res.clearCookie("authToken"); // clear the correct cookie
      return res.redirect("/coreLogin");
    }
    const { id } = req.params;

    const bus = await Bus.findById(id);

    return res.render("administrator/bus.ejs", { bus, user });
  } catch (error) {}
});
router.post("/busEntire/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stops, // this should be an array of stop objects
      ...busData
    } = req.body;

    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ error: "Bus not found" });
    }

    const existingStops = bus.routeStops || [];
    const updatedStops = [];
    const createStops = [];

    for (let i = 0; i < stops.length; i++) {
      const incomingStop = stops[i];

      if (
        incomingStop.stopName &&
        incomingStop.morningTime &&
        incomingStop.eveningTime &&
        incomingStop.latitude &&
        incomingStop.longitude
      ) {
        if (i < existingStops.length) {
          // Update existing stop
          existingStops[i].stopName = incomingStop.stopName;
          existingStops[i].morningTime = incomingStop.morningTime;
          existingStops[i].eveningTime = incomingStop.eveningTime;
          existingStops[i].latitude = incomingStop.latitude;
          existingStops[i].longitude = incomingStop.longitude;

          updatedStops.push(existingStops[i]);
        } else {
          // Add new stop
          createStops.push(incomingStop);
        }
      }
    }
    bus.set({ ...busData, stops: updatedStops });

    // 2. Add new stops to the routeStops array
    if (createStops.length > 0) {
      bus.routeStops.push(...createStops);
    }

    // 3. Save the updated bus document
    await bus.save();

    return res.json({ message: "Bus updated successfully", bus });
  } catch (error) {
    console.error("Error updating bus:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

router.post("/busDocuments/:id", upload.any(), async (req, res) => {
  try {
    const { id } = req.params;
    const { paperNames } = req.body;
    const files = req.files;

    const documentNames = Array.isArray(paperNames) ? paperNames : [paperNames];

    // Creating an array of document objects
    const documents = files.map((file, index) => ({
      name: documentNames[index] || "Unknown Document", // Default if name is missing
      url: file.path.split("public")[1], /// File path
    }));

    // Find the conductor and update its documents
    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ message: "bus not found" });
    }

    bus.busDocuments.push(...documents);
    await bus.save();

    return res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/deleteBusDocument/:docId/:busId", async (req, res) => {
  try {
    const { docId, busId } = req.params;

    // Find the bus
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    // Find the specific document
    const targetDoc = bus.busDocuments.find(
      (doc) => doc._id.toString() === docId
    );

    if (!targetDoc) {
      return res.status(404).json({ message: "Document not found" });
    }

    // Build absolute path from relative path
    const absolutePath = path.join(process.cwd(), "public", targetDoc.url);

    // Delete the file if it exists
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Remove the document from the array
    bus.busDocuments = bus.busDocuments.filter(
      (doc) => doc._id.toString() !== docId
    );

    await bus.save(); // Save updated bus

    // Redirect back
    return res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
  } catch (error) {
    console.error("Error deleting document:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/busIcon/:id", upload.single("iconPhoto"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // Fetch conductor by ID
    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ message: "bus not found" });
    }

    // Update profile
    const fullPath = req.file.path;
    const relativePath = fullPath.split("public")[1];
    bus.iconPhoto = relativePath;
    await bus.save();

    console.log("File uploaded:", req.file);

    // Redirect user after successful upload
    res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/busImages/:id", upload.any(), async (req, res) => {
  try {
    // Get the bus ID from the route params
    const { id } = req.params;

    // Get the uploaded files from the request
    const uploadedFiles = req.files;

    // Map through the uploaded files and get the relative paths
    const busImagePaths = uploadedFiles.map((file) => {
      const fullPath = file.path; // Full path (e.g., "public/uploads/abc123.jpg")
      const relativePath = fullPath.split("public")[1]; // Extract relative path (e.g., "/uploads/abc123.jpg")
      return relativePath; // Store only the relative path
    });

    // Find the bus by ID and x its busImages field with the new image paths
    const bus = await Bus.findById(id);

    if (!bus) {
      return res.status(404).send("Bus not found");
    }

    // Add new images to the busImages array
    bus.busImages = [...bus.busImages, ...busImagePaths];

    // Save the bus with the updated busImages
    await bus.save();

    // Redirect user after successful upload
    res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
  } catch (error) {
    console.error(error);
    res.status(500).send("Error uploading images");
  }
});

router.get("/deleteImage/:index/:busId", async (req, res) => {
  try {
    const { index, busId } = req.params;

    // Find the bus
    const bus = await Bus.findById(busId);
    if (!bus) {
      return res.status(404).json({ message: "Bus not found" });
    }

    // Make sure index is valid
    const imageIndex = parseInt(index);
    if (
      isNaN(imageIndex) ||
      imageIndex < 0 ||
      imageIndex >= bus.busImages.length
    ) {
      return res.status(400).json({ message: "Invalid image index" });
    }

    // Get relative path from busImages (e.g., "/uploads/abc.jpg")
    const relativePath = bus.busImages[imageIndex];

    // Convert to absolute path
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    // Delete file from disk if exists
    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
    }

    // Remove the image from the array
    bus.busImages.splice(imageIndex, 1);
    await bus.save();

    // Redirect to settings page
    return res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
  } catch (error) {
    console.error("Error deleting image:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// Track Route

router.get("/tracker", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("administrator/liveViews.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/liveStream/:id", async (req, res) => {
  let bus = await Bus.findById(req.params.id);

  return res.render("administrator/busStream.ejs", { bus });
});

// Regarding Admin

router.get("/addAdmin", async (req, res) => {
  try {
    const admins = await CORE.find({ role: "admin" });
    // console.log(admins);

    const user = await CORE.findById(req.user.id);

    if (user) {
      return res.render("administrator/addAdmin.ejs", { admins, user });
    } else {
      res.clearCookie("authToken"); // clear the correct cookie
      return res.redirect("/coreLogin");
    }
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res
      .status(500)
      .send("Something went wrong while fetching admins. Contact Developer");
  }
});
router.post("/addAdmin", async (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email || !username) {
      return res
        .status(400)
        .json({ done: false, message: "Email and username are required" });
    }

    const existingUser = await CORE.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ done: false, message: "Admin with this email already exists" });
    }

    const passwordPlain = generatePassword();

    const adminId = "ADM-" + uuidv4();

    const newAdmin = new CORE({
      email,
      username,
      password: passwordPlain,
      role: "admin",
      adminId,
    });

    await newAdmin.save();

    res.status(201).json({
      done: true,
      message: "Admin successfully created",

      newAdmin,
    });
  } catch (err) {
    console.error("Error adding admin:", err);
    res.status(500).json({ done: false, message: "Internal server error" });
  }
});

router.post("/deleteAdmin", async (req, res) => {
  try {
    const { id } = req.body;
    const result = await CORE.findByIdAndDelete(id);

    if (!result) {
      return res.status(404).json({ done: false, message: "Admin not found" });
    }

    return res.status(200).json({ done: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ done: false, message: "Server error" });
  }
});

// particular bus live preview

export { router as administratorRouter };
