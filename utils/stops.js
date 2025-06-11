import FCM from "../model/FCM.js";
import { sendNotificationToClient } from "./notify.js";

export const sendNotification = async (stopId, stopName, busNumber) => {
  if (!stopId) return;

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
