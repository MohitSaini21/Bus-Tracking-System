// Importing Required Modules
import express from "express"; // Core framework for building the server
import { config } from "dotenv"; // For environment variable management
import { adminRouter } from "./routes/admin.js";
import { publicRouter } from "./routes/public.js";
import { Socket } from "socket.io";

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
app.use("/driver", driverRouter);

// Handler if user want's to communicate over webScoket protocols
import { Server } from "socket.io";
const io = new Server(server);
// Object to store busId -> array of socketIds
let busConnections = {};
let allAdmins = [];
let drivers = [];

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
    if (socket.handshake.query.driverBusId) {
      console.log(`New Driver Conncection: ${socket.id}`);
      drivers.push(socket.handshake.query.driverBusId);
      console.log(drivers);
      socket.driverBusId = socket.handshake.query.driverBusId;
    }
  }

  socket.on("busLocationUpdate", (data) => {
    if (data.busId && busConnections[data.busId]) {
      for (let i = 0; i < busConnections[data.busId].length; i++) {
        io.to(busConnections[data.busId][i]).emit("receivelocation", data);
      }
    } else {
      console.warn(`No one is looking for this bus location: ${data.busId}`);
    }
    if (allAdmins.length) {
      for (let i = 0; i < allAdmins.length; i++) {
        io.to(allAdmins[i]).emit("allBusLocations", data);
      }
    } else {
      console.warn(`No admin is looking for this bus location: ${data.busId}`);
    }
  });

  socket.on("locationError", (data) => {});

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
      console.log(`${socket.id} has disconnectect (driver)`);
      if (drivers.includes(socket.driverBusId)) {
        // 2. Remove the element from the array
        let index = drivers.indexOf(socket.driverBusId);
        drivers.splice(index, 1); // Removes the element at the specified index
        console.log(`${socket.driverBusId} was removed (driver).`, drivers);
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
