import mongoose from "mongoose";

const fcmSchema = new mongoose.Schema({
  fcmToken: {
    type: String,
    required: true,

    index: true,
  },
  busId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bus",
    required: true,
  },
  stopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Stop",
    required: true,
  },
  stop: {
    type: Object, // Embedded full stop details (stopName, morningTime, etc.)
    required: true,
  },
  role: {
    type: String,
    enum: ["student", "driver", "admin"],
    default: "student",
  },

  expireDate: {
    type: Date,
    required: true,
    index: { expireAfterSeconds: 0 }, // TTL index: delete when expireDate is reached
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  isActive: {
    type: Boolean,
    default: true, // Can be used to soft-disable tokens
  },
});

const FCM = mongoose.model("FCM", fcmSchema);

export default FCM;
