export const sendNotification = async (
  stopId,
  stopName,
  busNumber,
  isMorning,
  busId,
  expectedTime,
  readableTime,
  timeLine
) => {
  if (!stopId) return console.warn("⛔ No stopId provided, skipping.");

  await connectToDatabase();

  try {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const fcmUsers = await FCM.find({
      stopId,
      isActive: true,
      $or: [
        { lastConsidered: { $lt: twentyMinutesAgo } },
        { lastConsidered: { $exists: false } },
        { lastConsidered: null },
      ],
    });

    console.log(`🔎 Found ${fcmUsers.length} FCM users for stop ${stopName}`);

    if (fcmUsers.length > 0) {
      for (const fcm of fcmUsers) {
        const message = isMorning
          ? `Good morning! Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`
          : `Bus (${busNumber}) might reach anytime at ${stopName}. Please be ready to board or exit.`;

        await sendNotificationToClient(fcm.fcmToken, "Bus Location", message);
        console.log(`📲 Notification sent to token ${fcm.fcmToken}`);
      }

      await FCM.updateMany(
        { _id: { $in: fcmUsers.map((u) => u._id) } },
        { $set: { lastConsidered: new Date() } }
      );

      console.log(`✅ Updated lastConsidered for notified users`);
    }

    // ------------------ LOG ACTIVITY SECTION --------------------
    const todayStart = moment().tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment().tz("Asia/Kolkata").endOf("day").toDate();

    const log = await BusActivityLog.findOne({
      bus: busId,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });

    const nowTime = moment().tz("Asia/Kolkata").format("hh:mm A");
    console.log(`🕐 Logging activity at ${nowTime} for bus ${busNumber}`);

    if (log) {
      let stopLog = log.stops.find(
        (s) => s.stop?.toString() === stopId.toString()
      );

      if (stopLog) {
        console.log("📌 Stop already exists in log");

        if (isMorning) {
          if (stopLog.morningTime || stopLog.eMorningTime)
            return console.log("🔁 Morning time already logged, skipping.");

          stopLog.stopName = stopName;
          stopLog.eMorningTime = expectedTime + " AM";
          stopLog.morningTime = readableTime;
        } else {
          if (stopLog.eveningTime || stopLog.eEveningTime)
            return console.log("🔁 Evening time already logged, skipping.");

          stopLog.stopName = stopName;
          stopLog.eEveningTime = expectedTime + " PM";
          stopLog.eveningTime = readableTime;
        }
      } else {
        console.log("➕ Adding new stop entry");

        const newStop = {
          stop: stopId,
          stopName,
          ...(isMorning
            ? {
                eMorningTime: expectedTime + " AM",
                morningTime: readableTime,
              }
            : {
                eEveningTime: expectedTime + " PM",
                eveningTime: readableTime,
              }),
        };

        log.stops.push(newStop);
      }

      if (timeLine) {
        log.events.push(timeLine);
        console.log("🧾 Added timeline event");
      }

      await log.save();
      console.log("📦 Log saved successfully");
    } else {
      console.log("🆕 Creating new activity log");

      const newLog = new BusActivityLog({
        bus: busId,
        stops: [
          {
            stop: stopId,
            stopName,
            ...(isMorning
              ? {
                  eMorningTime: expectedTime + " AM",
                  morningTime: readableTime,
                }
              : {
                  eEveningTime: expectedTime + " PM",
                  eveningTime: readableTime,
                }),
          },
        ],
        events: timeLine ? [timeLine] : [],
      });

      await newLog.save();
      console.log("📘 New log created and saved");
    }
  } catch (error) {
    console.error("❌ Error in sendNotification:", error);
  }
};
