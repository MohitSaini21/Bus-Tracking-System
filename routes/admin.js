import express from "express";
import Driver from "../modal/driver.js";
import Conductor from "../modal/conductor.js";
import Bus from "../modal/Bus.js";
import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";

let router = express.Router();

// Configure Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.resolve(`./public/uploads/`));
  },
  filename: function (req, file, cb) {
    const FileName = `${Date.now()}-${file.originalname}`;
    cb(null, FileName);
  },
});
const upload = multer({ storage: storage });

// Routes
router.get("/", (req, res) => res.render("admin/index.ejs"));
router.get("/addBus", (req, res) => res.render("admin/addBus.ejs"));

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
        driverId: driverData.data.driverId,
        name: driverData.data.driverName, // Fix variable name mismatch
        phone: driverData.data.driverPhone, // Fix variable name mismatch
        licenseNumber: driverData.data.driverLicenseNumber, // Fix variable name mismatch
        address: driverData.data.driverAddress, // Fix variable name mismatch
        joiningDate: driverData.data.DriverJoiningDate,
        status: "Active", // Default status
        profilePhoto: "/assets/images/faces/driver.png",
      });

      driverDocId = newDriver._id; // Store the driver's ID
      console.log("Driver created successfully:", newDriver);
    }

    if (conductorData) {
      // Create a new conductor
      const newConductor = await Conductor.create({
        conductorId: conductorData.data.conductorId,
        name: conductorData.data.conductorName, // Fix variable name mismatch
        phone: conductorData.data.conductorPhone, // Fix variable name mismatch
        address: conductorData.data.conductorAddress, // Fix variable name mismatch
        joiningDate: conductorData.data.conductorJoiningDate,
        status: "Active", // Default status
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

  res.render("admin/garrage.ejs", { buses });
});

router.get("/conductorDriver", async (req, res) => {
  let { driverId = "N/A", conductorId = "N/A" } = req.query;

  // ✅ Driver ID valid hai → Process karo
  if (driverId !== "N/A") {
    try {
      const driver = await Driver.findById(driverId);
      if (driver) {
        // console.log(driver);
        return res.render("admin/conDriver.ejs", { worker: driver });
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
        return res.render("admin/conDriver.ejs", { worker: conductor });
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
        `/tmu/admin/settings/conductorDriver?conductorId=${conductor._id}`
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
      `/tmu/admin/settings/conductorDriver?conductorId=${conductor._id}`
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
        `/tmu/admin/settings/conductorDriver?conductorId=${conductor._id}`
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
      `/tmu/admin/settings/conductorDriver?conductorId=${conductor._id}`
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
      `/tmu/admin/settings/conductorDriver?driverId=${conductor._id}`
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
        `/tmu/admin/settings/conductorDriver?driverId=${conductor._id}`
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
      `/tmu/admin/settings/conductorDriver?driverId=${conductor._id}`
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

    return res.render("admin/bus.ejs", { bus });
  } catch (error) {}
});
router.post("/busEntire/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { stopName, morningTime, eveningTime, ...busData } = req.body;

    // Creating routeStops array
    const routeStops = stopName.map((name, index) => ({
      stopName: name,
      morningTime: morningTime[index],
      eveningTime: eveningTime[index],
    }));

    // Updating the bus document
    const bus = await Bus.findByIdAndUpdate(
      id,
      { ...busData, routeStops }, // Merging other fields with routeStops
      { new: true } // Return the updated document
    );

    console.log("Updated Bus:", bus);

    return res.render("admin/bus.ejs", { bus });
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
      `http://localhost:3000/tmu/admin/settings/busEntire/67e8ed79552f9251eff61392`
    );
  } catch (error) {
    console.error("Error uploading documents:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Bus

router.get("/CDB", (req, res) => {
  return res.render("admin/CDB.ejs");
});

// Track Route

router.get("/tracker", (req, res) => {
  return res.render("admin/tracker.ejs");
});

export { router as adminRouter };
