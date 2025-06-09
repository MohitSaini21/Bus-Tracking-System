import moment from "moment";

import BusActivityLog from "../model/busTrack.js";

export const logBusEvent = async ({ busId, eventType, lat, lon }) => {
  try {
    const today = moment().startOf("day").toDate();
    const timestamp = moment().toDate();

    const update = {
      $push: {
        events: {
          event: eventType,
          timestamp,
          coordinates: [lon, lat], // [longitude, latitude]
        },
      },
      $setOnInsert: {
        bus: busId,
        date: today,
      },
    };

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    const result = await BusActivityLog.findOneAndUpdate(
      { bus: busId, date: today },
      update,
      options
    );

    console.log("Bus event logged:", result);
    return result;
  } catch (error) {
    console.error("Error logging bus event:", error);
    throw error;
  }
};
