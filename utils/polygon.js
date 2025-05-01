import * as turf from "@turf/turf";

import { logBusEvent } from "./updateExitEntry.js";

const tmuHeadCampus = turf.polygon([
  [
    [78.66361657971697, 28.822244722324484],
    [78.6661459526332, 28.825112490408713],
    [78.65713321095365, 28.82818569617592],
    [78.65321167331075, 28.82405891358536],
    [78.65600892925295, 28.821880139878317],
    [78.66361657971697, 28.822244722324484],
  ],
]);

export async function checkEntryExit(io, data, administratorIds) {
  const { previousPoint, currentPoint, bus } = data;

  if (!previousPoint || !currentPoint || !bus) {
    console.warn("⚠️ Incomplete data provided to checkEntryExit.");
    return;
  }

  const previousGeoJsonPoint = turf.point([
    previousPoint.longitude,
    previousPoint.latitude,
  ]);
  const currentGeoJsonPoint = turf.point([
    currentPoint.longitude,
    currentPoint.latitude,
  ]);

  const wasInside = turf.booleanPointInPolygon(
    previousGeoJsonPoint,
    tmuHeadCampus
  );
  const isInside = turf.booleanPointInPolygon(
    currentGeoJsonPoint,
    tmuHeadCampus
  );

  try {
    if (!wasInside && isInside) {
      console.log(`🟢 Bus ${bus.busNumber} has ENTERED the campus.`);
      await logBusEvent({
        busId: bus._id,
        eventType: "Entered",
        lat: currentPoint.latitude,
        lon: currentPoint.longitude,
      });
    } else if (wasInside && !isInside) {
      console.log(`🔴 Bus ${bus.busNumber} has EXITED the campus.`);
      await logBusEvent({
        busId: bus._id,
        eventType: "Exited",
        lat: currentPoint.latitude,
        lon: currentPoint.longitude,
      });
    } else {
      console.log(`🟡 Bus ${bus.busNumber} has no entry/exit change.`);
    }
  } catch (err) {
    console.error("❌ Failed to log entry/exit:", err.message);
  }
}
