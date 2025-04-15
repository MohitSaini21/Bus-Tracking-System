const socket = io({
  query: {
    liveBusId: bus._id, // Convert the _id to a string (if it’s a MongoDB ObjectId)
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

socket.on("connectionDenied", (message) => {
  alert(message);
});
socket.on("connectionApproved", (message) => {
  console.log(message);
});
const iceConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302", // Google STUN server
    },
    // Optionally add TURN servers here
  ],
};

var peerConnection;

async function collectionIceCandidateInfo() {
  peerConnection = new RTCPeerConnection(iceConfig);

  const stream = await navigator.mediaDevices.getUserMedia({
    video: true, // Request access to the webcam
  });

  stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

  peerConnection.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit("ice-candidate", {
        bus, // Ensure `bus` is defined (e.g., bus._id)
        candidate: event.candidate,
      });
    }
  };

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);

  socket.emit("offer", {
    bus,
    offer,
  });
}

socket.on("offer", ({ offer }) => {
  if (offer) {
    peerConnection
      .setRemoteDescription(new RTCSessionDescription(offer))
      .catch((error) =>
        console.error("Error setting remote description:", error)
      );
  }
});

// Listen for the admin's ICE candidate
socket.on("admin-ice-candidate", ({ busId, candidate }) => {
  if (peerConnection) {
    peerConnection
      .addIceCandidate(new RTCIceCandidate(candidate))
      .catch((error) => console.error("Error adding ICE candidate:", error));
  }
});

// Handle admin's answer to the offer from the driver
socket.on("admin-answer", ({ busId, answer }) => {
  if (peerConnection) {
    peerConnection
      .setRemoteDescription(new RTCSessionDescription(answer))
      .catch((error) =>
        console.error("Error setting remote description:", error)
      );
  }
});

window.onload = () => {
  collectionIceCandidateInfo();
};

socket.on("request-new-offer", ({ busId }) => {
  console.log("Refreshing Offer ");
  // Re-create new peer connection and new offer
  collectionIceCandidateInfo(); // Your existing function
});

// setupDisconnectHandlers();

// function setupDisconnectHandlers() {
//   // Catch abrupt close or page reload (before the user navigates away)
//   window.addEventListener("beforeunload", () => {
//     console.log("Driver is disconnecting...");
//     socket.emit("bus-disconnected", { busId: bus._id }); // Use the correct event to notify about bus disconnection
//   });

//   // ICE connection monitoring (for WebRTC connection state changes)
//   peerConnection.oniceconnectionstatechange = () => {
//     console.log("ICE state changed:", peerConnection.iceConnectionState);
//     if (
//       peerConnection.iceConnectionState === "disconnected" ||
//       peerConnection.iceConnectionState === "failed"
//     ) {
//       console.warn("Driver ICE disconnected.");
//       socket.emit("bus-disconnected", { busId: bus._id }); // Emit when ICE connection fails or gets disconnected
//     }
//   };

//   // WebRTC connection state monitoring (connection established or closed)
//   peerConnection.onconnectionstatechange = () => {
//     console.log("Connection state:", peerConnection.connectionState);
//     if (
//       peerConnection.connectionState === "disconnected" ||
//       peerConnection.connectionState === "closed" ||
//       peerConnection.connectionState === "failed"
//     ) {
//       console.warn("Driver connection closed.");
//       socket.emit("bus-disconnected", { busId: bus._id }); // Notify that the bus connection is closed
//     }
//   };
// }
