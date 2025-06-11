import moment from "moment-timezone";
import mongoose from "mongoose";
import BusActivityLog from "../model/busTrack.js";

export default async function saveLogs(busObject) {
  if (!busObject.reachedStops && !busObject.path) {
    console.log("🛑 Neither stops nor path provided. Cannot save log.");
    return;
  }

  try {
    const busId = new mongoose.Types.ObjectId(busObject.busId);
    const todayStart = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment().tz("Asia/Kolkata").endOf("day").toDate();

    const log = await BusActivityLog.findOne({
      bus: busId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    // Convert reachedStops into stop log array
    const stopsData = [];
    for (const stopId in busObject.reachedStops) {
      const stop = busObject.reachedStops[stopId];
      const stopLog = {
        stop: stopId,
        stopName: stop.stopName || null,
        morningTime: stop.morning || null,
        eveningTime: stop.evening || null,
        eMorningTime: stop.eMorningTime || null,
        eEveningTime: stop.eEveningTime || null,
      };
      stopsData.push(stopLog);
    }

    if (log) {
      // 🚀 Update existing log
      for (const newStop of stopsData) {
        const existingStop = log.stops.find(
          (s) => s.stop.toString() === newStop.stop
        );

        if (existingStop) {
          // Update only if the new data exists and isn't already present
          if (newStop.morningTime && !existingStop.morningTime) {
            existingStop.morningTime = newStop.morningTime;
          }
          if (newStop.eMorningTime && !existingStop.eMorningTime) {
            existingStop.eMorningTime = newStop.eMorningTime;
          }
          if (newStop.eveningTime && !existingStop.eveningTime) {
            existingStop.eveningTime = newStop.eveningTime;
          }
          if (newStop.eEveningTime && !existingStop.eEveningTime) {
            existingStop.eEveningTime = newStop.eEveningTime;
          }
          if (newStop.stopName && !existingStop.stopName) {
            existingStop.stopName = newStop.stopName;
          }
        } else {
          // New stop? Add to log
          log.stops.push(newStop);
        }
      }

      // Append new path points if provided
      if (busObject.path && Array.isArray(busObject.path)) {
        log.path = log.path.concat(busObject.path);
      }

      await log.save();
      console.log(`📝 Updated today's log for bus ${busObject.busId}`);
    } else {
      // 🆕 Create new log entry
      const newLog = new BusActivityLog({
        bus: busId,
        date: new Date(),
        stops: stopsData,
        path: busObject.path || [],
      });

      await newLog.save();
      console.log(`🆕 Created new log for bus ${busObject.busId}`);
    }
  } catch (err) {
    console.error("❌ Error saving bus logs:", err.message);
  }
}
