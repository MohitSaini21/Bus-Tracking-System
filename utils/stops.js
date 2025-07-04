import mongoose from "mongoose";
import FCM from "../model/FCM.js";
import moment from "moment-timezone";
import BusActivityLog from "../model/busTrack.js";
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
  isMorning,
  busId,
  expectedTime,
  readableTime,
  timeLine
) => {
  if (!stopId) return;

  await connectToDatabase();

  try {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const fcmUsers = await FCM.find({
      stopId,
      isActive: true,
      $or: [
        { lastConsidered: { $lt: twentyMinutesAgo } },
        { lastConsidered: { $exists: false } },
        { lastConsidered: null },
      ],
    });

    if (fcmUsers.length > 0) {
      for (const fcm of fcmUsers) {
        const message = isMorning
          ? `Good morning! Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`
          : `Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`;

        await sendNotificationToClient(fcm.fcmToken, "Bus Location", message);
      }

      // Update their lastConsidered timestamp after sending
      await FCM.updateMany(
        { _id: { $in: fcmUsers.map((u) => u._id) } },
        { $set: { lastConsidered: new Date() } }
      );
    }

    const todayStart = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment().tz("Asia/Kolkata").endOf("day").toDate();

    const log = await BusActivityLog.findOne({
      bus: busId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const nowTime = moment().tz("Asia/Kolkata").format("hh:mm A");

    if (log) {
      let stopLog = log.stops.find(
        (s) => s.stop?.toString() === stopId.toString()
      );

      if (stopLog) {
        // ✅ STOP exists
        if (isMorning) {
          if (stopLog.morningTime || stopLog.eMorningTime) return;

          stopLog.stopName = stopName;
          stopLog.eMorningTime = expectedTime + " AM";
          stopLog.morningTime = readableTime;
        } else {
          if (stopLog.eveningTime || stopLog.eEveningTime) return;

          stopLog.stopName = stopName;
          stopLog.eEveningTime = expectedTime + " PM";
          stopLog.eveningTime = readableTime;
        }
      } else {
        // ➕ Create new stop log entry
        const newStop = {
          stop: stopId,
          stopName,
        };

        if (isMorning) {
          newStop.eMorningTime = expectedTime + " AM";
          newStop.morningTime = readableTime;
        } else {
          newStop.eEveningTime = expectedTime + " PM";
          newStop.eveningTime = readableTime;
        }

        log.stops.push(newStop);
      }
      if (timeLine) {
        {
          log.events.push(timeLine);
        }
      }

      await log.save(); // ✅ Always save if anything is modified
    } else {
      if (isMorning) {
        const newLog = new BusActivityLog({
          bus: busId,

          stops: [
            {
              stop: stopId,
              stopName: stopName,
              eMorningTime: expectedTime,
              morningTime: readableTime,
            },
          ],
        });
      } else {
        const newLog = new BusActivityLog({
          bus: busId,

          stops: [
            {
              stop: stopId,
              stopName: stopName,
              eEveningTime: expectedTime,
              eveningTime: readableTime,
            },
          ],
        });

        await newLog.save();
      }
    }
  } catch (error) {
    console.error("Error sending notifications:", error);
  }
};
