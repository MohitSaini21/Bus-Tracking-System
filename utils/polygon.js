import * as turf from "@turf/turf";

// Define a polygon using latitudes and longitudes
const tmuHeadCampus = turf.polygon([
  [
    [78.66361657971697, 28.822244722324484],
    [78.6661459526332, 28.825112490408713],
    [78.65713321095365, 28.82818569617592],
    [78.65321167331075, 28.82405891358536],
    [78.65600892925295, 28.821880139878317],
    [78.66361657971697, 28.822244722324484],
  ],
]);

export function checkEntryExit(io, data, administratorIds) {
  const { previousPoint, currentPoint, bus } = data;

  // Convert the points into GeoJSON format
  const previousGeoJsonPoint = turf.point([
    previousPoint.longitude,
    previousPoint.latitude,
  ]);
  const currentGeoJsonPoint = turf.point([
    currentPoint.longitude,
    currentPoint.latitude,
  ]);

  // Check if the previous and current points are inside the polygon (campus)
  const wasInside = turf.booleanPointInPolygon(
    previousGeoJsonPoint,
    tmuHeadCampus
  );
  const isInside = turf.booleanPointInPolygon(
    currentGeoJsonPoint,
    tmuHeadCampus
  );

  // Log entry or exit based on the previous and current positions
  if (!wasInside && isInside) {
    // Temproary

    // Temprorary Alerts

    if (administratorIds.length) {
      for (let i = 0; i < administratorIds.length; i++) {
        io.to(administratorIds[i]).emit(
          "campusAlert",
          `Bus ${bus.busNumber} has entered the campus.`
        );
      }
    }

    // Temprorary Alerts
    // Temproary

    console.log(`Bus ${bus.busNumber} has entered the campus.`);
  } else if (wasInside && !isInside) {

        if (administratorIds.length) {
          for (let i = 0; i < administratorIds.length; i++) {
            io.to(administratorIds[i]).emit(
              "campusAlert",
              `Bus ${bus} has exited the campus.`
            );
          }
        }
    console.log(`Bus ${bus} has exited the campus.`);
  } else {

      if (administratorIds.length) {
        for (let i = 0; i < administratorIds.length; i++) {
          io.to(administratorIds[i]).emit(
            "campusAlert",
            `Bus ${bus.busNumber} is ${isInside ? "inside" : "outside"} the campus`
          );
        }
      }
    console.log(
      `Bus ${bus.busNumber} is ${isInside ? "inside" : "outside"} the campus.`
    );
  }
}
