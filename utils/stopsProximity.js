import { getDistance } from "geolib";
import moment from "moment-timezone";

export default async function evaluateBusProximityToStops(
  io,
  data,
  busObject,
  administratorIds
) {
  try {
    console.log(`✅ Checking if bus ${data.bus._id} has reached any stop...`);

    const bus = data.bus;
    const busLat = parseFloat(data.latitude);
    const busLng = parseFloat(data.longitude);
    const RADIUS_METERS = 50;

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

        // Temprorary Alerts

        if (administratorIds.length) {
          for (let i = 0; i < administratorIds.length; i++) {
            io.to(administratorIds[i]).emit(
              "tempAlert",
              `📍 Bus ${data.bus._id} reached "${stop.stopName}" at ${currentTime}`
            );
          }
        }

        // Temprorary Alerts
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
