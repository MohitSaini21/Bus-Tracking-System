import express from "express";
import Bus from "../modal/Bus.js";
let router = express.Router();

router.get("/", (req, res) => {
  return res.render("public/index.ejs");
});

router.post("/", async (req, res) => {
  console.log(req.body); // { from: 'Tmu', to: 'Nagina' }

  // Extract the 'from' and 'to' locations from the request body
  const { from, to } = req.body;

  // Normalize 'from' and 'to' by trimming spaces and converting to lowercase
  const normalizedFrom = from.trim().toLowerCase();
  const normalizedTo = to.trim().toLowerCase();

  // Create the two route strings:
  const route1 = `${normalizedFrom} to ${normalizedTo}`; // Tmu to Nagina
  const route2 = `${normalizedTo} to ${normalizedFrom}`; // Nagina to Tmu

  console.log("Generated Routes:", route1, route2);

  try {
    // Find buses whose route matches either of the two generated route strings
    const buses = await Bus.find({
      $or: [
        { route: { $regex: new RegExp(`^${route1}$`, "i") } }, // Match the first route (case-insensitive)
        { route: { $regex: new RegExp(`^${route2}$`, "i") } }, // Match the reversed route (case-insensitive)
      ],
    });

    // If no buses found, return an empty array or an appropriate message
    if (buses.length === 0) {
      return res
        .status(404)
        .json({ message: "No buses found for the given route" });
    }

    // Return the list of buses that match the search criteria
    return res.render("public/index.ejs", { buses });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  }
});

router.get("/particularBus/:id", async (req, res) => {
  const { id } = req.params;
  const bus = await Bus.findById(id);
  if (bus) {
    return res.render("public/particularBus.ejs", { bus });
  }
});

export { router as publicRouter };
