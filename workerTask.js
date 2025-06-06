import { parentPort } from "worker_threads";
import { getDistance } from "geolib";

parentPort.on("message", ({ task, busObject }) => {
  const bus = task.bus;
  const busLat = parseFloat(task.latitude);
  const busLng = parseFloat(task.longitude);
  const RADIUS_METERS = 50;
  const PROXIMITY_METERS = 100;
  const MIN_TIME_DIFF = 60 * 1000;
  const timestamp = task.timestamp;

  if (!busObject["lastPathTimestamp"]) {
    busObject["lastPathTimestamp"] = timestamp;
    if (!busObject["path"]) {
      busObject["path"] = [];
    }
    busObject["path"].push({ lat: busLat, lon: busLng });
    console.log("path has been updated  new lat and long has been added");
    console.log(busObject["path"]);
  } else {
    const timeDiff = timestamp - busObject["lastPathTimestamp"];
            if (timeDiff < MIN_TIME_DIFF) {
              console.log("Skipping Tracking Path");
            } else {
      busObject["path"].push({ lat: busLat, lon: busLng });
      busObject["lastPathTimestamp"] = task.timestamp; // update last tracking time
      console.log("path has been updated  new lat and long has been added");
    }
  }

  const now = new Date();
  const currentTime = now;
  const hour = now.getHours();
  const isMorning = hour < 12;

  if (!busObject.reachedStops) busObject.reachedStops = {};

  for (const stop of bus.routeStops) {
    const stopId = stop._id.toString();

    if (!stop.latitude || !stop.longitude) continue;

    const stopLat = parseFloat(stop.latitude);
    const stopLng = parseFloat(stop.longitude);

    if (
      (isMorning && busObject.reachedStops[stopId]?.morning) ||
      (!isMorning && busObject.reachedStops[stopId]?.evening)
    ) {
      continue;
    }

    const distance = getDistance(
      { latitude: busLat, longitude: busLng },
      { latitude: stopLat, longitude: stopLng }
    );

    if (distance <= RADIUS_METERS) {
      if (!busObject.reachedStops[stopId]) {
        busObject.reachedStops[stopId] = {};
      }

      if (isMorning) {
        busObject.reachedStops[stopId].morning = currentTime;
      } else {
        busObject.reachedStops[stopId].evening = currentTime;
      }

      console.log(
        `📍 Bus ${task.bus._id} reached "${stop.stopName}" at ${currentTime}`
      );
      break; // Found the stop, break out
    } else {
      console.log(
        `🚌 Bus ${task.bus._id} is ${distance}m away from stop "${stop.stopName}"`
      );
    }
  }

  // ✅ Post message ONCE after processing all stops
  parentPort.postMessage({
    updatedBusObject: busObject,
    busId: task.bus._id,
  });
});
