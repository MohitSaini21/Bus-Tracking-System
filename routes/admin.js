import express from "express";
import CORE from "../model/admin.js";
import Bus from "../model/bus.js";
import moment from "moment-timezone";
import Complaint from "../model/complain.js";
import mongoose from "mongoose";

import fs from "fs";
import path from "path";
import BusActivityLog from "../model/busTrack.js";

let router = express.Router();

router.post("/api/save-fcm-token", async (req, res) => {
  try {
    const { token } = req.body;

    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized: No user ID" });
    }

    if (!token) {
      return res.status(400).json({ message: "FCM token is required" });
    }

    const user = await CORE.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Save or update the token inside the user's schema (or in a separate FCM schema)
    user.notificationToken = token; // Assuming `notificationToken` exists in user schema
    await user.save();

    res
      .status(200)
      .json({ success: true, message: "FCM token saved successfully" });
  } catch (error) {
    console.error("Error saving FCM token:", error);
    res
      .status(500)
      .json({ success: false, message: "Server error while saving token" });
  }
});

// checked
router.get("/", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (!user) {
    res.clearCookie("authToken");
    return res.redirect("/coreLogin");
  }

  const totalCount = await Bus.countDocuments({});
  const operationalCount = await Bus.countDocuments({ status: "Operational" });
  const adminCount = await CORE.countDocuments({ role: "admin" });
  const Complaints = await Complaint.countDocuments({});
  const parentsComplaints = await Complaint.countDocuments({
    submittedBy: "parent",
  });

  res.render("adminAdministrator/index.ejs", {
    user,
    totalCount,
    operationalCount,
    adminCount,
    Complaints,
    parentsComplaints,
  });
});

// checked
router.get("/garrage", async (req, res) => {
  try {
    let filterCondition;

    if (req.query.search) {
      filterCondition = req.query.search;
    }

    const user = await CORE.findById(req.user.id);

    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }

    const buses = await Bus.find(
      {
        status: filterCondition
          ? filterCondition
          : { $in: ["Operational", "Out of Service"] },
      },
      {
        driver: 1,
        conductor: 1,
        route: 1,
        busNumber: 1,
      }
    );

    res.render("adminAdministrator/garrage.ejs", {
      buses,
      user,
      filterCondition,
    });
  } catch (error) {
    console.error("❌ Error in /garrage route:", error.message);
    res.status(500).send("❌ Server error occurred while loading garage data.");
  }
});

//checked
router.post("/changeStatus", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (!user) {
    res.clearCookie("authToken");
    return res.redirect("/coreLogin");
  }

  const { selectedIds, status } = req.body;

  try {
    if (!Array.isArray(selectedIds) || !status) {
      return res.status(400).json({ success: false, error: "Invalid input" });
    }

    const io = req.app.get("io");

    // Update buses by busNumber
    const result = await Bus.updateMany(
      { busNumber: { $in: selectedIds } },
      { $set: { status } }
    );

    // If status is "Out of Service", disconnect their sockets
    if (status === "Out of Service") {
      // Step 1: Find the _id of affected buses
      const affectedBuses = await Bus.find({ busNumber: { $in: selectedIds } });
      const liveBusIds = affectedBuses.map((bus) => bus._id.toString()); // Ensure string

      // Step 2: Loop through all connected sockets
      for (const [socketId, socket] of io.sockets.sockets) {
        const queryBusId = socket.handshake.query?.liveBusId;

        if (queryBusId && liveBusIds.includes(queryBusId)) {
          socket.disconnect(true);
          console.log(`🔌 Disconnected socket for busId: ${queryBusId}`);
        }
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Error updating status or disconnecting:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

router.get("/CDB/:busId", async (req, res) => {
  const busId = req.params.busId;

  // 1️⃣ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(busId)) {
    return res.status(400).json({ message: "❌ Invalid complaint ID" });
  }

  const bus = await Bus.findById(busId) // ❌ Problem here
    .populate("driver")
    .populate("conductor")
    .lean();

  const user = await CORE.findById(req.user.id);  

  if (user) {
    return res.render("adminAdministrator/CDB.ejs", { user, bus });
  } else {
    res.clearCookie("authToken");
    return res.redirect("/coreLogin");
  }
});

router.get("/mapView", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    if (user.role == "administrator") {
      return res.render("administrator/mapView.ejs", { user });
    } else {
      return res.render("adminAdministrator/mapView.ejs", { user });
    }
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/gridView", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("adminAdministrator/gridView.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/particularBusLive/:id", async (req, res) => {
  let bus = await Bus.findById(req.params.id).populate("driver", "name phone"); // only fetch name and phone of driver
  // only fetch name and phone of conductor

  const user = await CORE.findById(req.user.id);

  const indiaToday = moment().tz("Asia/Kolkata").startOf("day");

  const startOfDayUTC = indiaToday.toDate();
  const endOfDayUTC = indiaToday.clone().endOf("day").toDate();

  const busLog = await BusActivityLog.findOne({
    bus: bus._id,
    date: {
      $gte: startOfDayUTC,
      $lte: endOfDayUTC,
    },
  });

  console.log(busLog);

  if (user) {
    return res.render("adminAdministrator/pTracking.ejs", {
      bus,
      user,
      busLog,
    });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

// checked
router.get("/complaints", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);

    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }

    const submitterType = req.query.by === "operator" ? "operator" : "parent"; // default to parent if not specified

    // Fetch complaints filtered by submitterType
    const complaints = await Complaint.find({ submittedBy: submitterType });

    return res.render("adminAdministrator/complaints.ejs", {
      user,
      complaints,
      submitterType,
    });
  } catch (err) {
    return res.status(500).send("Internal Server Error");
  }
});

//checked
router.delete("/deleteComplaint/:id", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (!user) {
    return res.status(404).json({ message: "❌ you are not in databases" });
  }

  const id = req.params.id;

  // 1️⃣ Validate MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "❌ Invalid complaint ID" });
  }

  try {
    // 2️⃣ Find complaint first (to get media URL before deletion)
    const complaint = await Complaint.findById(id);
    if (!complaint) {
      return res.status(404).json({ message: "❌ Complaint not found" });
    }

    // 3️⃣ Delete media file if it exists
    if (complaint.media) {
      const absolutePath = path.join(process.cwd(), "public", complaint.media);
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`🗑️ Media file deleted: ${absolutePath}`);
      }
    }

    // 4️⃣ Delete the complaint from DB
    await Complaint.findByIdAndDelete(id);

    return res.json({ message: "✅ Complaint deleted successfully" });
  } catch (error) {
    console.error("❌ Error while deleting complaint:", error);
    return res.status(500).json({ message: "❌ Server error occurred" });
  }
});

router.get("/particularHistory/:id", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);
    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).send("Bus not found");

    const requestedDate = req.query.date;

    let busLog = null;

    if (requestedDate) {
      const startOfDay = moment(requestedDate, "YYYY-MM-DD").startOf("day");
      const endOfDay = moment(requestedDate, "YYYY-MM-DD").endOf("day");

      busLog = await BusActivityLog.findOne({
        bus: req.params.id,
        date: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() },
      });
    } else {
      busLog = await BusActivityLog.findOne({ bus: req.params.id }).sort({
        date: -1,
      });
    }

    return res.render("adminAdministrator/history.ejs", {
      user,
      bus,
      busLog, // single log object
      requestedDate: requestedDate || null,
      moment, // ✅ pass moment to EJS
    });
  } catch (err) {
    console.error("GET /particularHistory error:", err.message);
    return res.status(500).send("Internal Server Error");
  }
});

// Regardin Routing machines

router.get("/routingMachine/:id", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);
    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }

    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).send("Bus not found");

    const requestedDate = req.query.date;

    let busLog = null;

    if (requestedDate) {
      const startOfDay = moment(requestedDate, "YYYY-MM-DD").startOf("day");
      const endOfDay = moment(requestedDate, "YYYY-MM-DD").endOf("day");

      busLog = await BusActivityLog.findOne({
        bus: req.params.id,
        date: { $gte: startOfDay.toDate(), $lte: endOfDay.toDate() },
      });
    }

    return res.render("adminAdministrator/machine.ejs", {
      user,
      bus,
      busLog,
    });
  } catch (err) {
    console.log(err.message);
    return res.status(500).send("Internal Server Erro");
  }
});

router.get("/logout", async (req, res) => {
  try {
    if (req.user.id) {
      await CORE.findByIdAndUpdate(req.user.id, { isLogged: false });
    }

    res.clearCookie("authToken");
    return res.redirect("/coreLogin");
  } catch (error) {
    console.error("Logout error:", error);
    res.clearCookie("authToken");
    return res.redirect("/coreLogin"); // safe fallback
  }
});
// Final Touch Routes

router.get("/inActiveVehicles", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);

    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }
    const buses = await Bus.find({}, { busNumber: 1, route: 1, _id: 1 })
      .populate("driver", "name phone")
      .populate("conductor", "name phone");

    console.log(buses);

    res.render("adminAdministrator/activeBuses.ejs", { user, buses });
  } catch (error) {}
});
router.get("/changePass", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (!user) {
    res.clearCookie("authToken");
    return res.redirect("/coreLogin");
  }

  res.render("adminAdministrator/changePass.ejs", {
    user,
  });
});
router.post("/changePass", async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 🔐 Validate empty fields
    if (!currentPassword || !newPassword) {
      return res.json({
        success: false,
        message: "❌ Please fill in both password fields.",
      });
    }

    const userId = req.user?.id;

    // 🔐 Validate session/user token
    if (!userId) {
      return res.json({
        success: false,
        message: "❌ You are not in Database",
      });
    }

    // 🔐 Find admin or administrator
    const user = await CORE.findOne({
      _id: userId,
      role: { $in: ["admin", "administrator"] },
    });

    if (!user) {
      return res.json({
        success: false,
        message: "❌ You are not in Database",
      });
    }

    // 🔐 Check if current password matches
    if (user.password !== currentPassword) {
      return res.json({
        success: false,
        message: "❌ Current password is incorrect.",
      });
    }

    // ❌ Reject same as previous password
    if (newPassword === currentPassword) {
      return res.json({
        success: false,
        message: "❌ New password must be different from the current password.",
      });
    }

    // ✅ Update password
    user.password = newPassword;
    await user.save();

    return res.json({
      success: true,
      message: "✅ Password changed successfully.",
    });
  } catch (error) {
    console.error("❌ Error changing password:", error);
    return res.json({
      success: false,
      message: "❌ Server error. Please try again later.",
    });
  }
});

export { router as adminRouter };
