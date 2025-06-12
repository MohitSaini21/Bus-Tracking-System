import FCM from "../model/FCM.js";
import { sendNotificationToClient } from "./notify.js";

import mongoose from "mongoose";

const connectToDatabase = async () => {
  try {
    await mongoose.connect(
      "mongodb+srv://mohitsainisaini2680:misbaansari20@cluster0.wjx3j.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
    );
    console.log("✅ Worker: MongoDB connected");
  } catch (err) {
    console.error("❌ Worker: MongoDB connection error", err);
  }
};

export const sendNotification = async (stopId, stopName, busNumber) => {
  if (!stopId) return;

  await connectToDatabase(); // 👈 ensure this runs before calling `FCM.find(...)`

  try {
    const fcms = await FCM.find({ stopId: stopId });

    fcms.forEach((fcm) => {
      const fcmToken = fcm.fcmToken; // ✅ properly reference the token

      sendNotificationToClient(
        fcmToken,
        "Bus Location",
        `Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`
      );
    });
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};
