import moment from "moment-timezone";
import mongoose from "mongoose";
import BusActivityLog from "../model/busTrack.js";

export default async function saveLogs(busObject) {
  if (!busObject.reachedStops && !busObject.path) {
    console.log("🛑 Neither stops nor path provided. Cannot save log.");
    return;
  }
  try {
    const todayStart = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment().tz("Asia/Kolkata").endOf("day").toDate();

    const busId = new mongoose.Types.ObjectId(busObject.busId);

    // 1️⃣ Check if log already exists for today's date and this bus
    let log = await BusActivityLog.findOne({
      bus: busId,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    // 2️⃣ Convert reachedStops to array of objects for DB
    const stopsData = [];

    for (const stopId in busObject.reachedStops) {
      const stopLog = {
        stop: stopId,
        morningArrival: busObject.reachedStops[stopId].morning || null,
        eveningArrival: busObject.reachedStops[stopId].evening || null,
      };
      stopsData.push(stopLog);
    }

    if (log) {
      // Only update stops if stopsData is not empty
      if (stopsData.length > 0) {
        for (const newStop of stopsData) {
          const existingStop = log.stops.find(
            (s) => s.stop.toString() === newStop.stop
          );

          if (existingStop) {
            if (newStop.morningArrival && !existingStop.morningArrival) {
              existingStop.morningArrival = newStop.morningArrival;
            }
            if (newStop.eveningArrival && !existingStop.eveningArrival) {
              existingStop.eveningArrival = newStop.eveningArrival;
            }
          } else {
            log.stops.push(newStop);
          }
        }
      }

      if (busObject.path && busObject.path.length > 0) {
        log.path = [...log.path, ...busObject.path];
      }

      await log.save();
      console.log(`📝 Updated log for bus ${busObject.busId} on today.`);
    } else {
      const newLog = new BusActivityLog({
        bus: busId,
        date: new Date(),
        stops: stopsData,
        path: busObject.path ? busObject.path : [],
      });

      await newLog.save();
      busObject.path = [];

      console.log(`🆕 Created new log for bus ${busObject.busId}`);
    }
  } catch (err) {
    console.error("❌ Error saving bus logs:", err.message);
  }
}
