import express from "express";

let router = express.Router();

router.get("/tracker", (req, res) => {
  return res.render("admin/tracker.ejs");
});
export { router as adminRouter };
