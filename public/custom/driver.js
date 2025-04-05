let busId = "67e8ed79552f9251eff61392";
const socket = io({
  query: {
    driverBusId: busId, // Convert the _id to a string (if it’s a MongoDB ObjectId)
  },
});

const saveLocation = (position) => {
  const locationData = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,

    accuracy: position.coords.accuracy,
    timestamp: Date.now(),
  };
  localStorage.setItem("lastLocation", JSON.stringify(locationData));
  return locationData;
};

const getLastKnownLocation = () => {
  const data = localStorage.getItem("lastLocation");
  if (data) {
    return JSON.parse(data);
  }
  return null;
};

navigator.geolocation.watchPosition(
  (position) => {
    let locationData = saveLocation(position);
    locationData["busId"] = busId;

    console.log("Emitting Live Location:", locationData);
    socket.emit("busLocationUpdate", locationData);
  },
  (error) => {
    console.error("GPS Error:", error.message);
    let lastLocation = getLastKnownLocation();

    if (lastLocation && Date.now() - lastLocation.timestamp < 5 * 60 * 1000) {
      lastLocation["busId"] = busId;

      console.log("Emitting Cached Location:", lastLocation);
      socket.emit("busLocationUpdate", lastLocation);
    } else {
      let msg = {
        busId: busId,
        message: "Unable to fetch location within the given time.",
        timestamp: Date.now(),
      };

      console.error("No valid cached location available!");
      socket.emit("locationError", msg);
    }
  },
  {
    enableHighAccuracy: true,
    maximumAge: 5 * 60 * 1000, // Max 5 min purani location accept karega
    timeout: 10000, // 10 sec tak fresh location ka wait karega
  }
);
