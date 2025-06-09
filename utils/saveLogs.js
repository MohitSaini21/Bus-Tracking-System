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

    // Format stops data for DB
    const stopsData = [];
    for (const stopId in busObject.reachedStops) {
      const stopLog = {
        stop: stopId,
        morningArrival: busObject.reachedStops[stopId].morningTime || null,
        eveningArrival: busObject.reachedStops[stopId].eveningTime|| null,
      };
      stopsData.push(stopLog);
    }

    const newLog = new BusActivityLog({
      bus: busId,
      date: new Date(),
      stops: stopsData,
      path: busObject.path || [],
    });

    await newLog.save();
    console.log(`✅ Saved and cleared log for bus ${busObject.busId}`);

    // Optional: Clear path and other heavy objects if needed
    delete busObject.path;
    delete busObject.reachedStops;
  } catch (err) {
    console.error("❌ Error saving bus logs:", err.message);
  }
}
