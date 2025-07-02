import moment from "moment-timezone";
import mongoose from "mongoose";
import BusActivityLog from "../model/busTrack.js";

export default async function saveLogs(busObject) {
  if (!busObject.reachedStops && !busObject.path && !busObject.eventTimeline) {
    console.log("🛑 Nothing to save: no stops, path, or events.");
    return;
  }

  try {
    if (!busObject.busId || !mongoose.Types.ObjectId.isValid(busObject.busId)) {
      console.log("❌ Invalid or missing busId.");
      return;
    }
    const busId = new mongoose.Types.ObjectId(busObject.busId);

    const todayStart = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment().tz("Asia/Kolkata").endOf("day").toDate();

    const log = await BusActivityLog.findOne({
      bus: busId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    // Convert stops
    const stopsData = [];
    for (const stopId in busObject.reachedStops || {}) {
      const stop = busObject.reachedStops[stopId];
      stopsData.push({
        stop: stopId,
        stopName: stop.stopName || null,
        morningTime: stop.morningTime || null,
        eveningTime: stop.eveningTime || null,
        eMorningTime: stop.eMorningTime || null,
        eEveningTime: stop.eEveningTime || null,
      });
    }

    // Convert eventTimeline → events (database format)
    const eventsData = [];
    for (const item of busObject.eventTimeline || []) {
      if (item?.eventType && item?.time) {
        eventsData.push({
          campus: item.campus,
          event: item.eventType,
          timestamp: item.time,
        });
      }
    }

    if (log) {
      // ➕ Update existing log
      for (const newStop of stopsData) {
        const existingStop = log.stops.find(
          (s) => s.stop?.toString() === newStop.stop
        );
        if (existingStop) {
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
          log.stops.push(newStop);
        }
      }

      if (Array.isArray(busObject.path)) {
        log.path.push(...busObject.path);
        busObject.path = []; // ✅ Clear after saving
      }

      if (Array.isArray(eventsData) && eventsData.length > 0) {
        log.events.push(...eventsData);
        busObject.eventTimeline = []; // ✅ Clear after saving
      }

      await log.save();
      console.log(`📝 Updated today's log for bus ${busObject.busId}`);
      return;
    } else {
      // 🆕 New log
      const newLog = new BusActivityLog({
        bus: busId,
        stops: stopsData,
        path: busObject.path || [],
        events: eventsData,
      });

      await newLog.save();
      console.log(`🆕 Created new log for bus ${busObject.busId}`);

      // ✅ Clear after saving
      busObject.path = [];
      busObject.eventTimeline = [];
      return;
    }
  } catch (err) {
    console.error("❌ Error saving bus logs:", err.message);
    return;
  }
}
