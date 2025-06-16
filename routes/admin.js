import express from "express";
import CORE from "../model/admin.js";
import Bus from "../model/bus.js";
import moment from "moment-timezone";
import Complaint from "../model/complain.js";
import BusActivityLog from "../model/busTrack.js";
let router = express.Router();

// api
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

router.get("/", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    res.render("adminAdministrator/index.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
    return res.redirect("/coreLogin");
  }
});

router.get("/garrage", async (req, res) => {
  let filterCondition;

  if (req.query.search) {
    filterCondition = req.query.search;
  }

  const user = await CORE.findById(req.user.id);
  const buses = await Bus.find(
    {
      status: filterCondition
        ? filterCondition
        : { $in: ["Operational", "Out of Service"] },
    }, // Filter condition},
    {
      driver: 1,
      conductor: 1,
      route: 1,
      busNumber: 1,
    }
  );

  if (user) {
    res.render("adminAdministrator/garrage.ejs", {
      buses,
      user,
      filterCondition,
    });
  } else {
    res.clearCookie("authToken");

    return res.redirect("/coreLogin");
  }
});

router.post("/changeStatus", async (req, res) => {
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

router.get("/CDB", async (req, res) => {
  const user = await CORE.findById(req.user.id);

  if (user) {
    return res.render("adminAdministrator/CDB.ejs", { user });
  } else {
    res.clearCookie("authToken"); // clear the correct cookie
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

// New Handler for hte admin adn admsintrator got it

router.get("/complaints", async (req, res) => {
  try {
    const user = await CORE.findById(req.user.id);

    if (!user) {
      res.clearCookie("authToken");
      return res.redirect("/coreLogin");
    }

    // Read filter from query
    const submitterType = req.query.by === "operator" ? "operator" : "parent"; // default to parent if not specified

    // Fetch complaints filtered by submitterType
    const complaints = await Complaint.find({ submittedBy: submitterType });

    return res.render("adminAdministrator/complaints.ejs", {
      user,
      complaints,
      submitterType,
    });
  } catch (err) {
    console.error("GET /complaints error:", err.message);
    return res.status(500).send("Internal Server Error");
  }
});

router.delete("/deleteComplaint/:id", async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: "❌ Complaint not found" });
    }

    res.json({ message: "✅ Complaint deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "❌ Server error occurred" });
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

router.get("/logout", (req, res) => {
  res.clearCookie("authToken"); // clear the correct cookie
  return res.redirect("/coreLogin");
});
export { router as adminRouter };
