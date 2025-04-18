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
