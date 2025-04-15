// Importing Required Modules
import express from "express"; // Core framework for building the server
import { config } from "dotenv"; // For environment variable management
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { Socket } from "socket.io";
import { conductorRouter } from "./routes/conductor.js";
import { checkAuth } from "./middlware/rootCheckAuth.js";

import { driverRouter } from "./routes/driver.js";

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
app.use("/tmu/admin/settings", adminRouter);

app.use("/", publicRouter);
app.use(
  "/driver",
  checkAuth,
  (req, res, next) => {
    if (req.user.role == "driver") {
      next();
    }
  },
  driverRouter
);
app.use(
  "/conductor",
  checkAuth,
  (req, res, next) => {
    if (req.user.role == "conductor") {
      next();
    }
  },
  conductorRouter
);

// Handler if user want's to communicate over webScoket protocols
import { Server } from "socket.io";
const io = new Server(server);
// Object to store busId -> array of socketIds
let busConnections = {};
let allAdmins = [];
let liveBuses = [];
let liveVidoes = [];
let lastLocation = {};
// Memory-based store (can replace with DB)
const peers = {};

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
          console.log(
            `Bus ${busId} already live. Rejecting socket ${socket.id}`
          );

          socket.emit(
            "connectionDenied",
            "You cannot go live. Your mate is already live."
          );

          socket.disconnect(true);
          return;
        }

        // Register this socket as live
        liveBuses.push(busId);
        console.log(`Bus ${busId} is now live with socket ${socket.id}`);

        socket.emit("connectionApproved", "You are now live.");
        socket.liveBusId = busId; // Store it on socket for disconnect cleanup
      }
    }
  }

  // public to check whterthe bus is live or not
  socket.on("lastLocation", (busId, callback) => {
    console.log(busId);

    if (!liveBuses.includes(busId)) {
      callback({
        status: "false",
        data: lastLocation[busId],
      });
    }
  });

  // Admin Checking for liveVideos
  socket.on("liveVideos", (data, callback) => {
    console.log("Received liveVideos request from client");

    // Send the response back to the client using the callback
    callback({ liveBuses: liveVidoes });
  });
  // Admin Checking for liveVideos

  // Admin Disconnecwith
  socket.on("admin-disconnected", ({ busId }) => {
    console.log(
      "Admin DisconnectedAdmin DisconnectedAdmin DisconnectedAdmin DisconnectedAdmin DisconnectedAdmin DisconnectedAdmin"
    );

    if (peers[busId]) {
      // Invalidate old offer
      // Tell driver: "hey! admin wants to connect again, please send a fresh offer"
      io.to(peers[busId].driverSocketId).emit("request-new-offer", { busId });
    }
  });

  // Storig offer with the busId   and stroign ICE candiation information

  //
  // Refreshing all the fofer
  socket.on("refresh", ({ message }) => {
    console.log("Refresing all the offers");
    if (liveVidoes.length > 0) {
      for (let i = 0; i < liveVidoes.length; i++) {
        // Tell driver: "hey! admin wants to connect again, please send a fresh offer"

        io.to(peers[liveVidoes[i]].driverSocketId).emit("request-new-offer", {
          busId: liveVidoes[i],
        });
      }
    }
  });
  //

  // Store offer
  socket.on("offer", ({ bus, offer }) => {
    if (!peers[bus._id]) peers[bus._id] = {};
    peers[bus._id].offer = offer;
    peers[bus._id].driverSocketId = socket.id;
    if (!liveVidoes.includes(bus._id)) {
      liveVidoes.push(bus._id);
    }
    if (allAdmins.length > 0) {
      for (let i = 0; i < allAdmins.length; i++) {
        io.to(allAdmins[i]).emit("addliveBus", bus);
      }
    }
  });
  // Store ICE candidates
  socket.on("ice-candidate", ({ bus, candidate }) => {
    if (!peers[bus._id]) peers[bus._id] = {};
    if (!peers[bus._id].candidates) peers[bus._id].candidates = [];
    peers[bus._id].candidates.push(candidate);
  });

  // Storig offer with the busId   and stroign ICE candiation information

  // Admin Loking for ice candidate and off of particuarl bus
  socket.on("admin-wants-to-connect", ({ busId }) => {
    if (peers[busId]) {
      socket.emit("bus-offer-and-candidates", {
        offer: peers[busId].offer,
        candidates: peers[busId].candidates || [],
      });
    } else {
      socket.emit("bus-offer-and-candidates", {
        offer: null,
        candidates: null,
      });
    }
  });

  socket.on("admin-ice-candidate", ({ busId, candidate }) => {
    if (peers[busId]) {
      socket.broadcast.emit("ice-candidate", {
        bus: { _id: busId },
        candidate: candidate,
      });
    }
  });

  // Handle admin's answer to the offer from the driver
  socket.on("admin-answer", ({ busId, answer }) => {
    if (peers[busId]) {
      // Send the answer to the bus (driver)
      socket.broadcast.emit("offer", { bus: { _id: busId }, offer: answer });
    }
  });

  // Admin Loking for ice candidate and off of particuarl bus

  socket.on("busLocationUpdate", (data) => {
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
  });

  // You can listen for the disconnect event here
  socket.on("disconnect", () => {
    if (socket.adminId) {
      if (allAdmins.includes(socket.id)) {
        // 2. Remove the element from the array
        let index = allAdmins.indexOf(socket.id);
        allAdmins.splice(index, 1); // Removes the element at the specified index
        console.log(`${socket.id} was removed (Admin).`, allAdmins);
      }
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
      console.log(`${socket.id} has disconnectect`);
      if (socket.liveBusId) {
        if (socket.liveBusId && peers[socket.liveBusId]) {
          delete peers[socket.liveBusId]; // Clean up offers and candidates

          if (allAdmins.length) {
            for (let i = 0; i < allAdmins.length; i++) {
              io.to(allAdmins[i]).emit("bus-disconnected", socket.liveBusId);
            }
          }
          liveVidoes = liveVidoes.filter((id) => id !== socket.liveBusId);
          console.log(`Cleaned up peers for bus: ${socket.liveBusId}`);
        }
        const index = liveBuses.indexOf(socket.liveBusId);
        if (index !== -1) {
          liveBuses.splice(index, 1);
          console.log(
            `Bus ${socket.liveBusId} was removed from live list.`,
            liveBuses
          );
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

  ConnectDB(dbUrl);
  console.log(`✅ Server is running and listneing at the port ${PORT}`);
});
