const socket = io({
  query: {
    liveBusId: bus._id, // Convert the _id to a string (if it’s a MongoDB ObjectId)
  },
});
socket.on("connectionDenied", (message) => {
  alert(message);
  document.getElementById("cardBody").innerHTML = "";
  if (role == "driver") {
    document.getElementById(
      "cardBody"
    ).innerHTML = `<p>Hey You can not live now  </p> <br>       <button type="button" class="btn btn-secondary btn-fw"><a href="/driver">Back</a></button>
                      `;
  } else {
    document.getElementById(
      "cardBody"
    ).innerHTML = `<p>Hey You can not live now  </p> <br>       <button type="button" class="btn btn-secondary btn-fw"><a href="/conductor">Back</a></button>
                      `;
  }
});
socket.on("connectionApproved", (message) => {
  console.log(message);
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
    locationData["bus"] = bus;

    console.log("Emitting Live Location:", locationData);
    socket.emit("busLocationUpdate", locationData);
  },
  (error) => {
    console.error("GPS Error:", error.message);
    alert(`${error.message}`);

    let lastLocation = getLastKnownLocation();

    if (lastLocation && Date.now() - lastLocation.timestamp < 5 * 60 * 1000) {
      locationData[bus] = bus;

      console.log("Emitting Cached Location:", lastLocation);
      socket.emit("busLocationUpdate", lastLocation);
    } else {
    }
  },
  {
    enableHighAccuracy: true,
    maximumAge: 5 * 60 * 1000, // Max 5 min purani location accept karega
    timeout: 10000, // 10 sec tak fresh location ka wait karega
  }
);

let previousPoint = null;
let currentPoint = null;

// Function to get location
const getCurrentLocation = () => {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const point = {
          latitude,
          longitude,
          timestamp: Date.now(),
        };
        resolve(point);
      },
      (error) => {
        console.error("Error getting position:", error.message);
        reject(error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,

        maximumAge: 5 * 60 * 1000, // Max 5 min purani location accept karega
      }
    );
  });
};
  
// Poll every 5 seconds
setInterval(async () => {
  try {
    const latestPoint = await getCurrentLocation();

    if (!previousPoint) {
      previousPoint = latestPoint;
      return;
    }

    currentPoint = latestPoint;

    // Send just lat & lng
    const data = {
      previousPoint,
      currentPoint,

      bus,
    };

    console.log("Sending only lat/lng:", data);
    socket.emit("towPoints", data);

    // Prepare for next run
    previousPoint = currentPoint;
  } catch (err) {
    console.warn("Location fetch failed:", err.message);
  }
}, 5000);
