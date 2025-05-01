import Bus from "../model/bus.js";
import BusActivityLog from "../model/busTrack.js";

export default async function updateDistance(id, distance) {
  try {
    // Get today's date in YYYY-MM-DD format
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Check if a bus activity log exists for today
    const existingLog = await BusActivityLog.findOne({
      bus: id,
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (existingLog) {
      // If the log exists, update the distance for that log
      existingLog.distance += distance; // Add the new distance
      await existingLog.save(); // Save the updated log
      console.log(`Updated distance for Bus ${id} on ${today.toDateString()}`);
    } else {
      // If no log exists for today, create a new log entry
      const newLog = new BusActivityLog({
        bus: id,
        date: today,
        distance: distance, // Set initial distance
        stops: [], // You can initialize this if required
        path: [], // You can initialize this if required
        events: [], // You can initialize this if required
      });
      await newLog.save();
      console.log(`Created new log for Bus ${id} on ${today.toDateString()}`);
    }

    // Update the bus distance in the Bus model (this may be a cumulative distance across all days)
    await Bus.findByIdAndUpdate(id, {
      $inc: { distanceTravelled: distance }, // Increment the current distance by the given distance
    });
    console.log(`Updated bus ${id} total distance travelled`);
  } catch (error) {
    console.error("Error updating distance:", error);
  }
}
