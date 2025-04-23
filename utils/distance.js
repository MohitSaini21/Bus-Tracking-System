import Bus from "../model/bus.js";

export default async function updateDistance(id, distance) {
  try {
    // Update the bus document by incrementing the distanceTravelled field

    if (distance === 0) {
      return false;
    }
    await Bus.findByIdAndUpdate(id, {
      $inc: { distanceTravelled: distance }, // Increment the current distance by the given distance
    });
    return true;
  } catch (error) {
    console.error("Error updating distance:", error);
    return false;
  }
}
