import { parentPort } from "worker_threads";
import { getDistance } from "geolib";
import moment from "moment-timezone";
import { checkEntryExit } from "./utils/polygon.js";
import { sendNotification } from "./utils/stops.js";

parentPort.on("message", ({ task }) => {
  try {
    const bus = task.bus;
    const busId = bus._id;
    const busLat = parseFloat(task.latitude);
    const busLng = parseFloat(task.longitude);
    const timestamp = task.timestamp;
    const readableTime = moment(timestamp).tz("Asia/Kolkata").format("hh:mm A");
    const isMorning = moment(timestamp).tz("Asia/Kolkata").hour() < 12;
    const RADIUS_METERS = 1000;
    let timeLine;

    // 1. Check entry/exit polygon if previous point is provided
    if (task.previousPoint) {
      try {
        let { campus, event } = checkEntryExit({
          previousPoint: task.previousPoint,
          currentPoint: { longitude: busLng, latitude: busLat },
        });
        if (event && campus) {
          timeLine = { campus, event, timestamp: readableTime };
        }
      } catch (err) {
        console.error("checkEntryExit failed:", err);
      }
    }

    for (const stop of task.bus.routeStops || []) {
      if (!stop || !stop._id || !stop.latitude || !stop.longitude) continue;

      const stopLat = parseFloat(stop.latitude);
      const stopLng = parseFloat(stop.longitude);
      const distance = getDistance(
        { latitude: busLat, longitude: busLng },
        { latitude: stopLat, longitude: stopLng }
      );

      if (distance <= RADIUS_METERS) {
        if (isMorning) {
          sendNotification(
            stop._id,
            stop.stopName,
            bus.busNumber,
            isMorning,
            busId,
            stop.morningTime,
            readableTime,
            timeLine
          );
        } else {
          sendNotification(
            stop._id,
            stop.stopName,
            bus.busNumber,
            isMorning,
            busId,
            stop.eveningTime,
            readableTime,
            timeLine
          );
        }

        console.log(`📍 Bus ${bus._id} reached "${stop.stopName}"`);
        break; // Only log one stop per location update
      } else {
        console.log(
          `🚌 Bus ${bus._id} is ${distance}m away from "${stop.stopName}"`
        );
      }
    }

    parentPort.postMessage({
      done: false,
    });
    console.log("📤 postMessage sent successfully to parent");
  } catch (err) {
    console.error("🚨 Worker thread failed:", err);
    parentPort.postMessage({ done: false });
  }
});
