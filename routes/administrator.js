import express from "express";
import CORE from "../model/admin.js";

import Bus from "../model/bus.js";
import Driver from "../model/driver.js";
import Conductor from "../model/conductor.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import generatePassword from "../utils/password.js";
import { rewind } from "@turf/turf";

let router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(`../public/uploads/`));
  },
  filename: function (req, file, cb) {
    const FileName = `${Date.now()}-${file.originalname}`;
    cb(null, FileName);
  },
});
const upload = multer({ storage: storage });

// Routes
router.get("/", (req, res) => res.render("administrator/index.ejs"));
router.get("/addBus", (req, res) => res.render("administrator/addBus.ejs"));

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

router.get("/garrage", async (req, res) => {
  const buses = await Bus.find({});
  console.log(buses);

  res.render("administrator/garrage.ejs", { buses });
});

router.get("/conductorDriver", async (req, res) => {
  let { driverId = "N/A", conductorId = "N/A" } = req.query;

  // ✅ Driver ID valid hai → Process karo
  if (driverId !== "N/A") {
    try {
      const driver = await Driver.findById(driverId);
      if (driver) {
        // console.log(driver);
        return res.render("administrator/conDriver.ejs", { worker: driver });
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
        return res.render("administrator/conDriver.ejs", { worker: conductor });
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
    const { id } = req.params;

    const bus = await Bus.findById(id);
    console.log(bus);

    return res.render("administrator/bus.ejs", { bus });
  } catch (error) {}
});
router.post("/busEntire/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      stopName,
      morningTime,
      eveningTime,
      latitude,
      longitude,
      ...busData
    } = req.body;

    // Creating routeStops array
    const routeStops = stopName
      .map((name, index) => {
        const mTime = morningTime[index];
        const eTime = eveningTime[index];
        const lat = latitude[index];
        const long = longitude[index];

        if (name && mTime && eTime && lat && long) {
          return {
            stopName: name,
            morningTime: mTime,
            eveningTime: eTime,
            latitude: lat,
            longitude: long,
          };
        }

        return null; // skip if any value is missing
      })
      .filter(Boolean); // removes all null entries


      

    // Updating the bus document
    const bus = await Bus.findByIdAndUpdate(
      id,
      { ...busData, routeStops }, // Merging other fields with routeStops
      { new: true } // Return the updated document
    );

    console.log("Updated Bus:", bus);

    return res.redirect(`/tmu/administrator/settings/busEntire/${bus._id}`);
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
      url: file.path, // File path
    }));

    // Find the conductor and update its documents
    const bus = await Bus.findById(id);
    if (!bus) {
      return res.status(404).json({ message: "Conductor not found" });
    }

    bus.busDocuments.push(...documents);
    await bus.save();

    return res.redirect(
      `http://localhost:3000/tmu/administrator/settings/busEntire/${bus._id}`
    );
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ message: "Internal server error" });
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

    // Find the bus by ID and update its busImages field with the new image paths
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

// Bus

router.get("/CDB", (req, res) => {
  return res.render("administrator/CDB.ejs");
});

// Track Route

router.get("/tracker", (req, res) => {
  return res.render("administrator/tracker.ejs");
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
    return res.render("administrator/addAdmin.ejs", { admins });
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
router.get("/particularBusLive/:id", async (req, res) => {
  let bus = await Bus.findById(req.params.id);
  if (bus) {
    return res.render("administrator/paritcularBusLive.ejs", { bus });
  }
});
export { router as administratorRouter };
