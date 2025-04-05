import express from "express";
let router = express.Router();
router.get("/", (req, res) => {
  return res.render("driver/index.ejs");
});

export { router as driverRouter };
