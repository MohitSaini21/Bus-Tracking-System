import mongoose from "mongoose";

const { Schema, model } = mongoose;

const stopLogSchema = new Schema({
  stop: { type: Schema.Types.ObjectId, ref: "Stop", required: true },
  stopName: String,
  morningTime: Date,
  eMorningTime: Date,
  eveningTime: Date,
  eEveningTime: Date,
});

const busActivityLogSchema = new Schema(
  {
    bus: { type: Schema.Types.ObjectId, ref: "Bus", required: true },

    stops: [stopLogSchema], // Array of stop logs
    path: [
      {
        lat: { type: Number, required: true },
        lon: { type: Number, required: true },
      },
    ],
    events: [
      {
        campus: {
          type: String,
          rquired: true,
        },
        event: { type: String, enum: ["Entered", "Exited"], required: true },

        timestamp: { type: Date, required: true },
      },
    ],
    morningSnap: {
      reading: {
        type: Number,
      },
      image: {
        type: String, // URL or path to uploaded image
        required: false,
      },
      takenAt: {
        type: Date,
      },
    },
    eveningSnap: {
      reading: {
        type: Number,
      },
      image: {
        type: String, // URL or path to uploaded image
        required: false,
      },
      takenAt: {
        type: Date,
      },
    },
  },
  { timestamps: true }
);

const BusActivityLog = model("BusActivityLog", busActivityLogSchema);
export default BusActivityLog;
