import moment from "moment-timezone";
import mongoose from "mongoose";
import BusActivityLog from "../model/busTrack.js";

export default async function saveLogs(busObject) {
  console.log(busObject.reachedStops);

  if (
    (!busObject.reachedStops && !busObject.path) ||
    !busObject.busId ||
    Object.keys(busObject.reachedStops).length === 0
  ) {
    console.log("🛑 Bus has not covered any stops yet.");
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
      // 3️⃣ If log exists: update it — either append new stops or update existing ones
      for (const newStop of stopsData) {
        const existingStop = log.stops.find(
          (s) => s.stop.toString() === newStop.stop
        );

        if (existingStop) {
          // Update fields if they are not already set
          if (newStop.morningArrival && !existingStop.morningArrival) {
            existingStop.morningArrival = newStop.morningArrival;
          }
          if (newStop.eveningArrival && !existingStop.eveningArrival) {
            existingStop.eveningArrival = newStop.eveningArrival;
          }
        } else {
          // Add new stop entry
          log.stops.push(newStop);
        }
      }
      if (busObject.path && busObject.path.length > 0) {
        log.path = [...busObject.path];
      }
      await log.save();
      console.log(`📝 Updated log for bus ${busObject.busId} on today.`);
    } else {
      // 4️⃣ If no log exists: create a new one
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
