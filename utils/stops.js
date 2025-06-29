import mongoose from "mongoose";
import FCM from "../model/FCM.js";
import { sendNotificationToClient } from "./notify.js";

let isConnected = false; // Track whether we're connected

const connectToDatabase = async () => {
  if (isConnected) {
    console.log("✅ MongoDB already connected");
    return;
  }

  try {
    await mongoose.connect(
      "mongodb+srv://mohitsainisaini2680:misbaansari20@cluster0.wjx3j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    );
    isConnected = true; // Mark connection as successful
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection error", err);
  }
};

export const sendNotification = async (
  stopId,
  stopName,
  busNumber,
  isMorning
) => {
  if (!stopId) return;

  await connectToDatabase(); // 👈 Ensure this runs before calling FCM.find()

  try {
    const fcms = await FCM.find({ stopId: stopId, isActive: true });

    fcms.forEach((fcm) => {
      const fcmToken = fcm.fcmToken; // Properly reference the token

      // Determine the message based on `isMorning`
      const message = isMorning
        ? `Good morning! Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`
        : `Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`;

      // Send notification to client
      sendNotificationToClient(fcmToken, "Bus Location", message);
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};
