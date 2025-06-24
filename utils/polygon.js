import * as turf from "@turf/turf";

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



export function checkEntryExit({ previousPoint, currentPoint }) {
  if (!previousPoint || !currentPoint) {
    console.warn("⚠️ Incomplete data for checkEntryExit.");
    return null;
  }

  const previousGeoJsonPoint = turf.point([
    previousPoint.longitude,
    previousPoint.latitude,
  ]);
  const currentGeoJsonPoint = turf.point([
    currentPoint.longitude,
    currentPoint.latitude,
  ]);

  const wasInside = turf.booleanPointInPolygon(
    previousGeoJsonPoint,
    tmuHeadCampus
  );
  const isInside = turf.booleanPointInPolygon(
    currentGeoJsonPoint,
    tmuHeadCampus
  );

  if (!wasInside && isInside) {
    return "Entered";
  } else if (wasInside && !isInside) {
    return "Exited";
  } else {
    return null;
  }
}
