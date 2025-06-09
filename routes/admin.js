import express from "express";
import CORE from "../model/admin.js";
import Bus from "../model/bus.js";
import moment from "moment-timezone";
import BusActivityLog from "../model/busTrack.js";
let router = express.Router();

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
  let bus = await Bus.findById(req.params.id)
    .populate("driver", "name phone") // only fetch name and phone of driver
    .populate("conductor", "name phone"); // only fetch name and phone of conductor

  const user = await CORE.findById(req.user.id);

  // Get current date in Asia/Kolkata
  const indiaToday = moment().tz("Asia/Kolkata").startOf("day");

  // Convert to UTC for MongoDB date comparison
  const startOfDayUTC = indiaToday.toDate();
  const endOfDayUTC = indiaToday.clone().endOf("day").toDate();

  // Find today's log for a specific bus
  const busLog = await BusActivityLog.findOne({
    bus: bus._id,
    date: {
      $gte: startOfDayUTC,
      $lte: endOfDayUTC,
    },
  }).populate("stops.stop", "stopName");

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

router.get("/logout", (req, res) => {
  res.clearCookie("authToken"); // clear the correct cookie
  return res.redirect("/coreLogin");
});
export { router as adminRouter };
