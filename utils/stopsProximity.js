import { getDistance } from "geolib";
import moment from "moment-timezone";

export default async function evaluateBusProximityToStops(
  io,
  data,
  busObject,
  administratorIds,
  timestamp
) {
  try {
    console.log(`✅ Checking if bus ${data.bus._id} has reached any stop...`);

    const bus = data.bus;
    const busLat = parseFloat(data.latitude);
    const busLng = parseFloat(data.longitude);
    const RADIUS_METERS = 50;
    const PROXIMITY_METERS = 100;
    const MIN_TIME_DIFF = 1000;

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
        busObject["lastPathTimestamp"] = timestamp; // update last tracking time
        console.log("path has been updated  new lat and long has been added");
      }
    }

    const now = moment().tz("Asia/Kolkata"); // Change timezone if needed
    const isMorning = now.format("A") === "AM";
    const currentTime = now.toDate();

    if (!busObject.reachedStops) busObject.reachedStops = {}; // Track stops

    for (const stop of bus.routeStops) {
      const stopId = stop._id.toString();

      if (!stop.latitude || !stop.longitude) continue;

      const stopLat = parseFloat(stop.latitude);
      const stopLng = parseFloat(stop.longitude);

      // Skip if stop already marked as reached for this period
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

      if (distance <= PROXIMITY_METERS) {
        //  Heading closer notification
      }
      if (distance <= RADIUS_METERS) {
        // Update memory
        if (!busObject.reachedStops[stopId]) {
          busObject.reachedStops[stopId] = {};
        }

        if (isMorning) {
          busObject.reachedStops[stopId].morning = currentTime;
        } else {
          busObject.reachedStops[stopId].evening = currentTime;
        }

        console.log(
          `📍 Bus ${data.bus._id} reached "${stop.stopName}" at ${currentTime}`
        );

        // Notification system  over here if reaching bus

        // Notification system  over here

        // Optional: stop checking other stops if one is matched
        break;
      } else {
        console.log(
          `🚌 Bus ${data.bus._id} is ${distance}m away from stop "${stop.stopName}"`
        );
      }
    }
  } catch (err) {
    console.error("🔥 Error in evaluateBusProximityToStops:", err.message);
  }
}
