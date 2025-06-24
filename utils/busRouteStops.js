// utils/busRouteCache.js
import Bus from "../model/bus.js";

const routeStopMap = new Map();

/**
 * Load all buses and cache routeStops + iconPhoto
 */
export async function setAllRouteStops() {
  try {
    const buses = await Bus.find().select("_id routeStops iconPhoto");

    buses.forEach((bus) => {
      routeStopMap.set(bus._id.toString(), {
        routeStops: bus.routeStops,
        iconPhoto: bus.iconPhoto,
      });
    });

    console.log(`✅ Cached routeStops and icons for ${buses.length} buses.`);
    console.log(routeStopMap);
  } catch (err) {
    console.error("❌ Failed to cache bus data:", err);
  }
}

/**
 * Get routeStops and iconPhoto for a busId
 * @param {string} busId
 * @returns {object|null}
 */
export function getBusCacheData(busId) {
  return routeStopMap.get(busId) || null;
}
