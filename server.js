// Importing Required Modules
import express from "express"; // Core framework for building the server
import { config } from "dotenv"; // For environment variable management
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { Socket } from "socket.io";
import { conductorRouter } from "./routes/conductor.js";
import { checkAuth } from "./middlware/rootCheckAuth.js";

import { driverRouter } from "./routes/driver.js";
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
const peers = {};

let lastLocation = {};

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
          // If already live, reject and disconnect
          socket.emit(
            "connectionDenied",
            "This bus is already live from another device."
          );
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
      if (allAdmins.length) {
        for (let i = 0; i < allAdmins.length; i++) {
          io.to(allAdmins[i]).emit("newStream", bus._id);
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
    console.log(busId);

    if (!liveBuses.includes(busId)) {
      callback({
        status: "false",
        data: lastLocation[busId],
      });
    }
  });

  socket.on("towPoints", (data) => {
    checkEntryExit(data);
  });

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
        const busId = socket.liveBusId;
        if (busId && peers[busId]) {
          if (allAdmins.length) {
            for (let i = 0; i < allAdmins.length; i++) {
              console.log("Emiitting the event to delte the connection");
              io.to(allAdmins[i]).emit("deleteStream", busId);
            }
          }
          delete peers[busId]; // Clean up offers and candidates

          console.log(`Cleaned up peers for bus: ${busId}`);
          console.log(peers);
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

  ConnectDB(
    "mongodb+srv://mohitsainisaini2680:misbaansari20@cluster0.wjx3j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
  );
  console.log(`✅ Server is running and listneing at the port ${PORT}`);
});
