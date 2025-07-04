import moment from "moment-timezone";
import mongoose from "mongoose";
import BusActivityLog from "../model/busTrack.js";

export default async function saveLogs(busObject) {
  if (!busObject.path) {
    console.log("🛑 Nothing to save path");
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

    if (log) {
      if (Array.isArray(busObject.path)) {
        log.path.push(...busObject.path);
        busObject.path = []; // ✅ Clear after saving
      }

      await log.save();
      console.log(`📝 Updated today's log for bus ${busObject.busId}`);
      return;
    } else {
      // 🆕 New log
      const newLog = new BusActivityLog({
        bus: busId,

        path: busObject.path || [],
      });

      await newLog.save();
      console.log(`🆕 Created new log for bus ${busObject.busId}`);

      busObject.path = [];

      return;
    }
  } catch (err) {
    console.error("❌ Error saving bus logs:", err.message);
    return;
  }
}
