import express from "express";
import Bus from "../modal/Bus.js";
import Driver from "../modal/driver.js";
let router = express.Router();

// Driver
router.get("/", async (req, res) => {
  const bus = await Bus.findOne({
    driver: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("driver/index.ejs", { bus });
  }
});

router.get("/GoLive", async (req, res) => {
  const bus = await Bus.findOne({
    driver: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("driver/goLive.ejs", { bus, role: "driver" });
  }
});
router.get("/stream", async (req, res) => {
  const bus = await Bus.findOne({
    driver: req.user.id,
  })
    .populate("driver")
    .populate("conductor");
  if (bus) {
    return res.render("driver/stream.ejs", { bus, role: "driver" });
  }
});

export { router as driverRouter };
