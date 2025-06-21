// Importing Required Modules
import express from "express"; // Core framework for building the server
import { config } from "dotenv"; // For environment variable management
import updateDistance from "./utils/distance.js";
import evaluateBusProximityToStops from "./utils/stopsProximity.js";
import { dcRouter } from "./routes/DC.js";
import { sendNotificationToClient } from "./utils/notify.js";
import { Worker } from "worker_threads";
import os from "os";
import jwt from "jsonwebtoken";

import { administratorRouter } from "./routes/administrator.js";
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { Socket } from "socket.io";
import cron from "node-cron"; // or const cron = require('node-cron');

import saveLogs from "./utils/saveLogs.js";

import { checkAuth } from "./middlware/rootCheckAuth.js";
import cookie from "cookie"; // 🔥 NOT 'cookie-parser'

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
// Enable trust proxy
app.set("trust proxy", true);

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
  "/administrator/settings",
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
app.set("io", io); // <-- shared shelf mein rakh diy
// Object to store busId -> array of socketIds
let busConnections = {};

let allAdmins = [];
let administratorIds = [];
const peers = {};
let liveBuses = [];

let adminConnectionsBus = {};
let administratorConnectionsBus = {};

let lastLocation = new Map();

let locationEvaluationCooldown = 5 * 1000; // ms (5 seconds)
let lastEvaluated = {}; // { [busId]: timestamp }

// Cron Jobs
cron.schedule("0 0 * * *", () => {
  console.log("🕛 12:00 AM: Clearing lastEvaluated memory...");

  for (const busId in lastEvaluated) {
    delete lastEvaluated[busId];
  }

  console.log("🧹 Cleared all entries from lastEvaluated");
});

// Cron Jobs

//  NewArch Based Code

const MAX_WORKERS = os.cpus().length - 1; // 8 in your case
const workers = [];
const availableWorkers = [];

for (let i = 0; i < MAX_WORKERS; i++) {
  const worker = new Worker("./workerTask.js");
  workers.push(worker);
  availableWorkers.push(worker);
}
// ---- TASK & QUEUE MAPS ----
const taskQueues = new Map(); // Map<busId, Queue<Task>>
const isProcessing = new Map(); // Map<busId, Boolean>

// ---- Add task to bus queue ----
function addTask(task) {
  if (!taskQueues.has(task.bus._id)) {
    taskQueues.set(task.bus._id, []);
    isProcessing.set(task.bus._id, false);
  }

  taskQueues.get(task.bus._id).push(task);
  processQueue(task.bus._id); // Try to start processing
}

function processQueue(busId) {
  if (isProcessing.get(busId)) return;

  const queue = taskQueues.get(busId);
  if (!queue || queue.length === 0) return;

  if (availableWorkers.length > 0) {
    const task = queue.shift();
    const worker = availableWorkers.shift();
    const now = new Date();
    const start = Date.now();

    if (
      !lastEvaluated[busId] ||
      now - lastEvaluated[busId].lastEvaluations >= locationEvaluationCooldown
    ) {
      if (!lastEvaluated[busId]) {
        lastEvaluated[busId] = {
          busId,
          reachedStops: {},
          lastEvaluations: 0,
        };
      }

      lastEvaluated[busId].lastEvaluations = now;
      const busObject = lastEvaluated[busId];
      isProcessing.set(busId, true);

      worker.postMessage({ task, busObject });

      worker.once("message", (msg) => {
        if (msg?.updatedBusObject && msg?.busId) {
          isProcessing.set(msg.busId, false);
          lastEvaluated[msg.busId] = msg.updatedBusObject;
          if (adminConnectionsBus[msg.busId]) {
            // Iterate through each connected admin socket
            adminConnectionsBus[msg.busId].forEach((socket) => {
              if (socket && socket.emit) {
                socket.emit("busUpdate", {
                  busObject: lastEvaluated[msg.busId],
                });
              }
            });
          }

          availableWorkers.push(worker);
          const timeTaken = Date.now() - start;
          console.log(`✅ Worker done in ${timeTaken}ms`);
          processQueue(msg.busId);
        } else {
          console.warn("❌ Malformed message from worker:", msg);
          isProcessing.set(busId, false);
          availableWorkers.push(worker);
          processQueue(busId);
        }
        // Remove listeners to prevent memory leak
        worker.removeAllListeners();
      });

      worker.once("error", (err) => {
        console.error("Worker crashed:", err);
        isProcessing.set(busId, false);
        availableWorkers.push(worker);
        processQueue(busId);
        // Remove listeners to prevent memory leak
        worker.removeAllListeners();
      });

      worker.once("exit", (code) => {
        if (code !== 0) {
          console.warn(`Worker exited abnormally with code ${code}`);
        }
        isProcessing.set(busId, false);
        availableWorkers.push(worker);
        processQueue(busId);

        // Remove listeners to prevent memory leak
        worker.removeAllListeners();
      });
    } else {
      // Cooldown not passed, skip this round
      console.log("Skipping frequent Evulatating proximiy");
      availableWorkers.push(worker);
      processQueue(busId);
    }
  }
}

io.use((socket, next) => {
  try {
    const query = socket.handshake.query;

    // ✅ Allow public connections if no admin identifiers are present
    if (!query.adminId && !query.administratorId) {
      return next();
    }

    const rawCookies = socket.handshake.headers.cookie || "";

    const parsed = cookie.parse(rawCookies);
    const token = parsed.authToken;

    if (!token) {
      return next(new Error("Missing auth token"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "Secret String"
    );

    if (query.adminId) {
      socket.adminId = decoded.id;
    } else if (query.administratorId) {
      socket.administratorId = decoded.id;
    }

    return next();
  } catch (err) {
    console.error("🚨 JWT decode failed:", err.message);
    return next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  if (socket.handshake.query.busId) {
    // public Connection For locations
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
  } else if (socket.handshake.query.bus && socket.adminId) {
    const busId = socket.handshake.query.bus;

    socket.bus = busId;

    if (!adminConnectionsBus[busId]) {
      // If no array exists, create one
      adminConnectionsBus[busId] = [];
    }

    // Push the new socket.id into the array for the given busId
    adminConnectionsBus[busId].push(socket.id);

    console.log(
      `New connection of admin  for busId: ${busId} with socketId: ${socket.id}`
    );
    console.log(
      `Current connections  (admi) for bus ${busId}: `,
      adminConnectionsBus[busId]
    );
  } else if (socket.handshake.query.bus && socket.administratorId) {
    const busId = socket.handshake.query.bus;

    socket.bus = busId;

    if (!administratorConnectionsBus[busId]) {
      // If no array exists, create one
      administratorConnectionsBus[busId] = [];
    }

    // Push the new socket.id into the array for the given busId
    administratorConnectionsBus[busId].push(socket.id);

    console.log(
      `New connection of administrator  for busId: ${busId} with socketId: ${socket.id}`
    );
    console.log(
      `Current connections  (administrator) for bus ${busId}: `,
      administratorConnectionsBus[busId]
    );
  } else if (socket.administratorId) {
    console.log(`New administrator Connection: ${socket.id}`);
    administratorIds.push(socket.id);
    console.log(administratorIds);
  } else if (socket.adminId) {
    console.log(`New admin Connection: ${socket.id}`);
    allAdmins.push(socket.id);
    console.log(allAdmins);
  } else {
    if (socket.handshake.query.liveBusId) {
      // Bus(driver or conductor Connectiosn)
      const busId = socket.handshake.query.liveBusId;

      if (busId) {
        if (liveBuses.includes(busId)) {
          socket.disconnect(true); // 💥 Immediately close the connection
          return;
        } else {
          // Register this socket as live
          liveBuses.push(busId);
          if (allAdmins.length) {
            for (let i = 0; i < allAdmins.length; i++) {
              io.to(allAdmins[i]).emit("add", busId);
            }
          }

          console.log(`Bus ${busId} is now live with socket ${socket.id}`);

          socket.emit("connectionApproved", "You are now live.");
          socket.liveBusId = busId; // Store it on socket for disconnect cleanup
        }
      }
    }
  }

  // asking about is ther ebus obejt exist
  socket.on("liveBuses", async (callback) => {
    try {
      callback({ success: true, data: liveBuses });
    } catch (err) {
      console.error("Error fetching bus:", err);
      callback({ success: false, message: "Server error" });
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

      if (administratorConnectionsBus[bus._id]?.length) {
        // Iterate through each connected admin socket
        for (let i = 0; i < administratorConnectionsBus[bus._id].length; i++) {
          io.to(administratorConnectionsBus[bus._id][i]).emit(
            "newStream",
            bus._id
          );
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

  // About pTracking
  socket.on("getObject", async (data, callback) => {
    try {
      const busId = data.busId;

      // Simulate fetching the bus object from a database
      const busObject = lastEvaluated[busId]; // Use your DB model here

      if (busObject) {
        callback({ data: busObject }); // Send the object back to the client
      } else {
        callback({ data: null }); // Let the client know no data was found
      }
    } catch (error) {
      console.error("Error fetching bus object:", error);
      callback({ data: null, error: "Server error" });
    }
  });

  socket.on("lastLocation", (busId, callback) => {
    if (!liveBuses.includes(busId)) {
      callback({
        status: "false",
        data: lastLocation[busId] ? lastLocation[busId] : null,
      });
    }
  });

  socket.on("busLocationUpdate", (data) => {

    
    addTask(data);
    lastLocation.set(data.bus._id, data);

    if (data.bus && busConnections[data.bus._id]) {
      for (let i = 0; i < busConnections[data.bus._id].length; i++) {
        io.to(busConnections[data.bus._id][i]).emit("receivelocation", data);
      }
    }

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

  socket.on("disconnect", async () => {
    if (socket.bus) {
      const busId = socket.bus; // Now we can access busId from the socket object

      if (adminConnectionsBus[busId]) {
        adminConnectionsBus[busId] = adminConnectionsBus[busId].filter(
          (id) => id !== socket.id
        );
        console.log(
          `Updated admin connections for bus ${busId}: `,
          adminConnectionsBus[busId]
        );

        // Optionally, remove the busId key if no socket is connected to it
        if (adminConnectionsBus[busId].length === 0) {
          delete adminConnectionsBus[busId];
          console.log(
            `No more connections for bus of admin  ${busId}, deleting busId entry.`
          );
        }
      }
      if (administratorConnectionsBus[busId]) {
        administratorConnectionsBus[busId] = administratorConnectionsBus[
          busId
        ].filter((id) => id !== socket.id);
        console.log(
          `Updated administrator connections for bus ${busId}: `,
          administratorConnectionsBus[busId]
        );

        // Optionally, remove the busId key if no socket is connected to it
        if (administratorConnectionsBus[busId].length === 0) {
          delete administratorConnectionsBus[busId];
          console.log(
            `No more connections for bus of administrator  ${busId}, deleting busId entry.`
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
    } else {
      if (socket.liveBusId) {
        const busId = socket.liveBusId;

        const index = liveBuses.indexOf(socket.liveBusId);
        if (index !== -1) {
          liveBuses.splice(index, 1);
          if (allAdmins.length) {
            for (let i = 0; i < allAdmins.length; i++) {
              io.to(allAdmins[i]).emit("remove", busId);
            }
          }
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

          if (administratorConnectionsBus[busId]?.length) {
            // Iterate through each connected admin socket
            for (
              let i = 0;
              i < administratorConnectionsBus[busId].length;
              i++
            ) {
              io.to(administratorConnectionsBus[busId][i]).emit(
                "deleteStream",
                busId
              );
            }
          }
          delete peers[busId]; // Clean up offers and candidates

          console.log(`Cleaned up peers for bus: ${busId}`);
        }

        if (lastEvaluated[socket.liveBusId]) {
          saveLogs(lastEvaluated[socket.liveBusId]);
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
  // sendNotificationToClient(
  //   "dlf0rTyD0ghxObSl6icyYd:APA91bHvI8bqTKzXDzl6oAdU8ns-J_CVxn7ZctjmQR4LahAw7_CuJw6k2M_P9oxKbbgGBXBiFAZMVY7gMlolSIYBrDxXt7DLYf24mEc6NfcLYLUs4n8443w",
  //   "testing",
  //   "Bus is approaching you be there"
  // );
  console.log(`✅ Server is running and listneing at the port ${PORT}`);

  // hey there how are you
});
