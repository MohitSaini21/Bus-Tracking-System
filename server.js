// Importing Required Modules
import express from "express"; // Core framework for building the server
import { config } from "dotenv"; // For environment variable management
import updateDistance from "./utils/distance.js";
import evaluateBusProximityToStops from "./utils/stopsProximity.js";
import { dcRouter } from "./routes/DC.js";

import { administratorRouter } from "./routes/administrator.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { Socket } from "socket.io";
import cron from "node-cron"; // or const cron = require('node-cron');

import saveLogs from "./utils/saveLogs.js";

import { checkAuth } from "./middlware/rootCheckAuth.js";

import { checkEntryExit } from "./utils/polygon.js";

import ejs from "ejs";

import http from "http";

import moment from "moment-timezone";

import cookieParser from "cookie-parser";

import { ConnectDB } from "./config/db.js";

// Load Environment Variables
config();

const PORT = process.env.PORT || 8000; // Default to 8000 if PORT is not defined in .env
const dbUrl = process.env.DB_URL;

// Initialize Express App
const app = express();

// Initialize Passport

app.use(cookieParser());

// Middleware and Settings
// Set EJS as the view engine (Corrected 'view engine' typo)
app.set("view engine", "ejs");

// Middlewares for Parsing and Static Files (Optional, Add if Needed)
app.use(express.json()); // Parse JSON requests
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded requests
app.use(express.static("public")); // Serve static files from the "public" directory

// Import the HTTP module

// Create HTTP server and pass the app handler
const server = http.createServer(app);

// Routers
app.use(
  "/tmu/administrator/settings",
  checkAuth,
  (req, res, next) => {
    if (req.user?.role === "administrator") {
      next();
    } else {
      return res.status(204).end(); // silent drop
    }
  },
  administratorRouter
);
app.use(
  "/admin",
  checkAuth,
  (req, res, next) => {
    if (req.user?.role === "admin" || req.user?.role === "administrator") {
      next();
    } else {
      return res.status(204).end(); // silent drop
    }
  },
  adminRouter
);

// app.use("/admin");

app.use("/", publicRouter);

app.use(
  "/DC",
  checkAuth,
  (req, res, next) => {
    if (req.user.role == "conductor" || req.user.role == "driver") {
      next();
    }
  },
  dcRouter
);
// Handler if user want's to communicate over webScoket protocols
import { Server } from "socket.io";
const io = new Server(server);
// Object to store busId -> array of socketIds
let busConnections = {};

let allAdmins = [];
let administratorIds = [];
const peers = {};
let liveBuses = [];

let adminConnectionsBus = {};

let lastLocation = {};

let locationEvaluationCooldown = 5 * 1000; // ms (5 seconds)
let lastEvaluated = {}; // { [busId]: timestamp }

// Cron Jobs
cron.schedule("0 0 * * *", () => {
  console.log("🕛 Midnight reset: Clearing all tracking state...");
  for (const busId in lastEvaluated) {
    delete lastEvaluated[busId]; // full reset
  }
});
// Cron Jobs

// About the Distance

const distanceSession = {}; // { busId: { totalDistance, lastLocation: { lat, lng, timestamp } } }

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in kilometers
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const distanceInKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return distanceInKm * 1000; // ✅ Returns distance in meters
}
function calculateSpeed(lat1, lon1, t1, lat2, lon2, t2) {
  const distance = calculateDistance(lat1, lon1, lat2, lon2); // in meters
  const timeDiff = (t2 - t1) / 1000; // in seconds

  if (timeDiff === 0) return 0;

  const speedMetersPerSecond = distance / timeDiff;
  const speedKmPerHour = (speedMetersPerSecond * 3600) / 1000;

  return {
    mps: speedMetersPerSecond.toFixed(2),
    kmph: speedKmPerHour.toFixed(2),
  };
}
function updateBusDistance(
  io,
  busId,
  busNumber,
  latitude,
  longitude,
  timestamp,
  accuracy
) {
  const MIN_TIME_DIFF = 60 * 1000; // 30 seconds
  const MIN_DIST = 5; // in meters

  if (!distanceSession[busId]) {
    distanceSession[busId] = {
      totalDistance: 0,
      lastLocation: { latitude, longitude, timestamp, accuracy },
    };
    return;
  }

  const { lastLocation } = distanceSession[busId];

  const timeDiff = timestamp - lastLocation.timestamp;
  if (timeDiff < MIN_TIME_DIFF) {
    console.log("Skipping update distacne : too frequent");
    return;
  }
  const data = {
    previousPoint: {
      latitude: lastLocation.latitude,
      longitude: lastLocation.longitude,
    }, // Example coordinates
    currentPoint: { latitude, longitude }, // Example coordinates
    bus: {
      _id: busId,
      busNumber: busNumber,
      // any other properties you may need
    },
  };
  checkEntryExit(data);

  const distance = calculateDistance(
    lastLocation.latitude,
    lastLocation.longitude,
    latitude,
    longitude
  );

  const speed = calculateSpeed(
    lastLocation.latitude,
    lastLocation.longitude,
    lastLocation.timestamp,
    latitude,
    longitude,
    timestamp
  );
  // ✅ Notify all connected admins for this bus spped how about this
  if (adminConnectionsBus[busId]) {
    adminConnectionsBus[busId].forEach((id) => {
      io.to(id).emit("averageSpeed", speed);
    });
  }

  const combinedAccuracy = (accuracy || 0) + (lastLocation.accuracy || 0);

  if (distance < Math.max(MIN_DIST, combinedAccuracy)) {
    console.log(
      `Skipping update: distance ${distance.toFixed(
        2
      )}m < accuracy error ${combinedAccuracy}m`
    );

    distanceSession[busId].lastLocation.timestamp = timestamp;
    return;
  }

  // Ensure totalDistance is always an integer
  distanceSession[busId].totalDistance += Math.round(distance); // Rounds to nearest integer
  distanceSession[busId].lastLocation = {
    latitude,
    longitude,
    timestamp,
    accuracy,
  };
  // ✅ Notify all connected admins for this bus
  if (adminConnectionsBus[busId]) {
    adminConnectionsBus[busId].forEach((id) => {
      io.to(id).emit("distanceCovered", distanceSession[busId]);
    });
  }

  console.log(
    `✅ Updated: ${distance.toFixed(2)}m added | Total: ${distanceSession[
      busId
    ].totalDistance.toFixed(0)}m`
  );
}

io.on("connection", (socket) => {
  if (socket.handshake.query.busId) {
    const busId = socket.handshake.query.busId;

    // Store busId in socket object so it can be accessed later in the disconnect event
    socket.busId = busId;
    // Check if the busId already has an array of socketIds
    if (!busConnections[busId]) {
      // If no array exists, create one
      busConnections[busId] = [];
    }

    // Push the new socket.id into the array for the given busId
    busConnections[busId].push(socket.id);

    console.log(
      `New connection (Viewer) from busId: ${busId} with socketId: ${socket.id}`
    );
    console.log(
      `Current connections for bus ${busId}: `,
      busConnections[busId]
    );
  } else if (socket.handshake.query.bus && socket.handshake.query.adminId) {
    const busId = socket.handshake.query.bus;

    socket.bus = busId;
    socket.adminId = socket.handshake.query.adminId;

    if (!adminConnectionsBus[busId]) {
      // If no array exists, create one
      adminConnectionsBus[busId] = [];
    }

    // Push the new socket.id into the array for the given busId
    adminConnectionsBus[busId].push(socket.id);

    console.log(
      `New connection (admiin or adminsistror ) for busId: ${busId} with socketId: ${socket.id}`
    );
    console.log(
      `Current connections for bus ${busId}: `,
      adminConnectionsBus[busId]
    );
  } else if (socket.handshake.query.administratorId) {
    // We have to check from the databaes it's exist or not got it
    console.log(`New administrator Connection: ${socket.id}`);
    administratorIds.push(socket.id);
    console.log(administratorIds);
    socket.administratorId = socket.handshake.query.administratorId;
  } else if (socket.handshake.query.adminId) {
    console.log(`New admin Connection: ${socket.id}`);
    allAdmins.push(socket.id);
    console.log(allAdmins);
    socket.adminId = socket.handshake.query.adminId;
    // Executes if condition1 is false, and condition2 is true
  } else {
    if (socket.handshake.query.liveBusId) {
      const busId = socket.handshake.query.liveBusId;

      if (busId) {
        if (liveBuses.includes(busId)) {
          socket.disconnect(true); // 💥 Immediately close the connection
          return;
        } else {
          // Register this socket as live
          liveBuses.push(busId);
          console.log(`Bus ${busId} is now live with socket ${socket.id}`);

          socket.emit("connectionApproved", "You are now live.");
          socket.liveBusId = busId; // Store it on socket for disconnect cleanup
        }
      }
    }
  }

  socket.on("distanceTravelled", (busId, callback) => {
    const session = distanceSession[busId];
    if (session) {
      callback(Math.round(session.totalDistance)); // return whole number in meters
    } else {
      callback(0);
    }
  });
  // allStream
  socket.on("allStream", (callback) => {
    callback(Object.keys(peers));
  });

  // offer and icecandiate storegae
  socket.on("driver-offer", ({ bus, offer }) => {
    if (!peers[bus._id]) {
      console.log(
        "New connection !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!! ne Connection !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!"
      );
      if (administratorIds.length) {
        for (let i = 0; i < administratorIds.length; i++) {
          io.to(administratorIds[i]).emit("newStream", bus._id);
        }
      }
    }
    if (!peers[bus._id]) peers[bus._id] = {};
    peers[bus._id].offer = offer;
    peers[bus._id].socketID = socket.id;
    console.log("Offer saved for bus:", bus._id);
  });
  socket.on("ice-candidate", ({ bus, candidate }) => {
    if (!peers[bus._id]) peers[bus._id] = {};
    if (!peers[bus._id].candidates) peers[bus._id].candidates = [];
    peers[bus._id].candidates.push(candidate);
    console.log("ICE candidate saved for bus:", bus._id);
  });
  // admin checking whether offer and candiate exsit or not
  socket.on("admin-wants-to-connect", ({ busId }) => {
    if (peers[busId]) {
      socket.emit("bus-offer-and-candidates", {
        offer: peers[busId].offer,
        candidates: peers[busId].candidates || [],
      });
    } else {
      socket.emit("bus-offer-and-candidates", {
        offer: null,
        candidates: [],
      });
    }
  });

  // Admin REalted ice candiate and asnwer

  // Relay the admin's ICE candidate back to the driver
  socket.on("admin-ice-candidate", ({ busId, candidate }) => {
    if (peers[busId]) {
      io.to(peers[busId].socketID).emit("ice-candidate", {
        bus: { _id: busId },
        candidate: candidate,
      });
    }
  });

  // Handle admin's answer to the offer from the driver
  socket.on("admin-answer", ({ busId, answer }) => {
    if (peers[busId]) {
      // Send the answer to the bus (driver)
      io.to(peers[busId].socketID).emit("admin-answer", {
        bus: { _id: busId },
        offer: answer,
      });
    }
  });

  socket.on("admin-disconnected", ({ busId }) => {
    if (peers[busId]) {
      io.to(peers[busId].socketID).emit("refresh", {
        bus: { _id: busId },
      });

      // Clean up the peer entry
      peers[busId].offer = null;
      peers[busId].candidates = [];
      console.log(`Cleaned up peers[${busId}] after admin disconnect.`);
    }
  });

  // chekcin bus is live or not
  // public to check whterthe bus is live or not
  socket.on("lastLocation", (busId, callback) => {
    if (!liveBuses.includes(busId)) {
      callback({
        status: "false",
        data: lastLocation[busId] ? lastLocation[busId] : null,
      });
    }
  });

  // socket.on("towPoints", (data) => {
  //   checkEntryExit(data);
  // });

  socket.on("busLocationUpdate", (data) => {
    const busId = data.bus._id;
    const now = Date.now();

    updateBusDistance(
      io,
      data.bus._id,
      data.bus.busNumber,
      data.latitude,
      data.longitude,
      data.timestamp,
      data.accuracy
    );

    if (
      !lastEvaluated[busId] ||
      now - lastEvaluated[busId].lastEvaluations >= locationEvaluationCooldown
    ) {
      // Initialize the object if it doesn't exist
      if (!lastEvaluated[busId]) {
        lastEvaluated[busId] = { busId };
      }

      lastEvaluated[busId].lastEvaluations = now;

      // ⛳️ Evaluate: has the bus reached a stop?

      evaluateBusProximityToStops(
        io,
        data,
        lastEvaluated[busId],
        administratorIds,
        data.timestamp
      );
    }

    if (data.bus && busConnections[data.bus._id]) {
      for (let i = 0; i < busConnections[data.bus._id].length; i++) {
        io.to(busConnections[data.bus._id][i]).emit("receivelocation", data);
      }
    }

    if (!lastLocation[data.bus._id]) lastLocation[data.bus._id] = {};
    lastLocation[data.bus._id] = data;

    if (allAdmins.length) {
      for (let i = 0; i < allAdmins.length; i++) {
        io.to(allAdmins[i]).emit("allBusLocations", data);
      }
    }

    if (administratorIds.length) {
      for (let i = 0; i < administratorIds.length; i++) {
        io.to(administratorIds[i]).emit("allBusLocations", data);
      }
    }
  });

  // You can listen for the disconnect event here
  socket.on("disconnect", async () => {
    if (socket.bus) {
      const busId = socket.bus; // Now we can access busId from the socket object

      console.log(
        `Socket ${socket.id} disconnected from busId (admin or adminstrartoor): ${busId}`
      );

      if (adminConnectionsBus[busId]) {
        adminConnectionsBus[busId] = adminConnectionsBus[busId].filter(
          (id) => id !== socket.id
        );
        console.log(
          `Updated admin or administraot  connections for bus ${busId}: `,
          adminConnectionsBus[busId]
        );

        // Optionally, remove the busId key if no socket is connected to it
        if (adminConnectionsBus[busId].length === 0) {
          delete adminConnectionsBus[busId];
          console.log(
            `No more connections for bus of admin and admisniartor  ${busId}, deleting busId entry.`
          );
        }
      }
    } else if (socket.adminId) {
      if (allAdmins.includes(socket.id)) {
        // 2. Remove the element from the array
        let index = allAdmins.indexOf(socket.id);
        allAdmins.splice(index, 1); // Removes the element at the specified index
        console.log(`${socket.id} was removed (Admin).`, allAdmins);
      }
    } else if (socket.administratorId) {
      if (administratorIds.includes(socket.id)) {
        // 2. Remove the element from the array
        let index = administratorIds.indexOf(socket.id);
        administratorIds.splice(index, 1); // Removes the element at the specified index
        console.log(
          `${socket.id} was removed (administratorIds).`,
          administratorIds
        );
      }

      // const busId = socket.bus;
    } else if (socket.busId) {
      const busId = socket.busId; // Now we can access busId from the socket object

      console.log(
        `Socket ${socket.id} disconnected from busId (Viewer): ${busId}`
      );

      // Remove the socketId from the busId array when the socket disconnects
      if (busConnections[busId]) {
        busConnections[busId] = busConnections[busId].filter(
          (id) => id !== socket.id
        );
        console.log(
          `Updated connections for bus ${busId}: `,
          busConnections[busId]
        );

        // Optionally, remove the busId key if no socket is connected to it
        if (busConnections[busId].length === 0) {
          delete busConnections[busId];
          console.log(
            `No more connections for bus ${busId}, deleting busId entry.`
          );
        }
      }
      // const used = process.memoryUsage();
      // console.log(`Memory Usage: ${used.heapUsed}`);
    } else {
      if (socket.liveBusId) {
        const busId = socket.liveBusId;

        const index = liveBuses.indexOf(socket.liveBusId);
        if (index !== -1) {
          liveBuses.splice(index, 1);
          console.log(
            `Bus ${socket.liveBusId} was removed from live list.`,
            liveBuses
          );
        }
        if (busId && peers[busId]) {
          if (administratorIds.length) {
            for (let i = 0; i < administratorIds.length; i++) {
              console.log("Emiitting the event to delte the connection");
              io.to(administratorIds[i]).emit("deleteStream", busId);
            }
          }
          delete peers[busId]; // Clean up offers and candidates

          console.log(`Cleaned up peers for bus: ${busId}`);
        }

        if (lastEvaluated[socket.liveBusId]) {
          saveLogs(lastEvaluated[socket.liveBusId]);
        }
        if (distanceSession[socket.liveBusId]) {
          if (distanceSession[socket.liveBusId].totalDistance > 0) {
            await updateDistance(
              socket.liveBusId,
              distanceSession[socket.liveBusId].totalDistance
            );

            delete distanceSession[socket.liveBusId];
          }
        } else {
          console.log("No distance data found for bus ID:", socket.liveBusId);
        }
      }
    }
  });
});

// Starting the Server
server.listen(PORT, () => {
  // Convert UTC time to IST (Indian Standard Time)
  const timeInIST = moment().tz("Asia/Kolkata").format("YYYY-MM-DD HH:mm:ss");

  console.log("Time in IST:", timeInIST);
  // const used = process.memoryUsage();
  // console.log(`Memory Usage: ${used.heapUsed}`);

  ConnectDB(
    "mongodb+srv://mohitsainisaini2680:misbaansari20@cluster0.wjx3j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  );
  console.log(`✅ Server is running and listneing at the port ${PORT}`);
});
