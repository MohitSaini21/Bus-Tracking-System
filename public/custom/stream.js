setTimeout(() => {
  const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep trying forever
    reconnectionDelay: 3000, // Start with 3s delay
    reconnectionDelayMax: 10000,
    reconnection: false,
    query: {
      liveBusId: bus._id, // Convert the _id to a string (if it’s a MongoDB ObjectId)
    },
  });

  window.addEventListener("beforeunload", (e) => {
    // Always disconnect the socket first
    if (socket && socket.connected) {
      socket.disconnect();
      console.log("Socket disconnected properly before leaving.");
    }
  });


  socket.on("disconnect", (reason) => {
    if (reason == "io server disconnect") {
      connectionDenied();
      return;
    } else if (reason == "'io client disconnect") {
      return;
    } else if (reason == "ping timeout" || reason == "transport close") {
      const col = `
          <div class="container">

            <p>
Connecting... Please wait.

            </p>

          </div>
`;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = col.trim();
      const newCol = tempDiv.firstChild;

      const mainRow = document.getElementById("mainRow");
      mainRow.innerHTML = "";
      mainRow.appendChild(newCol);
    }
  });
  function connectionDenied() {
    const col = `
     <div class="col-12 grid-margin stretch-card" id="goBack">
   <div class="card">
      <div class="card-body" id="cardBody">
        <h4 class="card-title">
          ${user.name} (${user.role})
        </h4>
        <p class="card-description">
         
        This bus is already . <code>live</code>  and providing the bus location. You may go back.
           
              
        </p>
        <div class="template-demo">
          <button type="button" class="btn btn-secondary btn-fw">
            <a href="/DC" style="text-decoration: none; color: inherit;">Go Back</a>
          </button>
        </div>
      </div>
    </div>
    </div>

  `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = col.trim();
    const newCol = tempDiv.firstChild;
    document.getElementById("mainRow").innerHTML = "";
    document.getElementById("mainRow").appendChild(newCol); // ✅ This appends it at the end
  }


  
  socket.on("connectionApproved", (message) => {
    const col = `
        <div class="col-12 grid-margin stretch-card" id="goAhead">
                <div class="card">
                  <div class="card-body" id="cardBody">
       <h4 class="card-title">
        ${user.name}(${user.role})
    </h4>
    <p class="card-description">
        To Stop providing  your bus location, please click the <code>Checked Out</code> button.
    </p>
                    <div class="template-demo">
                                   <button type="button" class="btn btn-secondary btn-fw"><a href="/DC">Checked Out</a></button>
              <button type="button" class="btn btn-secondary btn-fw"><a href="  /DC/goLive">Stop Streaming </a></button>
                      
             
                      
                    </div>
                  </div>
     
                  
     
                  
         
                  
                </div>
              </div>
  `;

    let newColumn = `
  <div class="col-md-6 grid-margin stretch-card" id="videoTag">
  <div class="card">
    <div class="card-body p-0"> <!-- Remove padding for full container usage -->
      <video id="driverVideo" autoplay></video>
    </div>
  </div>
</div>`;

    let thirdCloumn = `<div class="col-md-6 grid-margin stretch-card" id="videoTag">
  <div class="card">
    <div class="card-body p-0  vector-map"   id="audience-map"> <!-- Remove padding for full container usage -->
      <iframe
        id="videoIframe"
        src="/locationBus/${bus._id}"  <!-- Replace with actual source -->
        frameborder="0"
        style="width: 100%; height: 100%;"
        allow="autoplay; fullscreen"></iframe>
    </div>
  </div>
</div>
`;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = col.trim();
    const newCol = tempDiv.firstChild;
    document.getElementById("mainRow").innerHTML = "";

    document.getElementById("mainRow").appendChild(newCol); // ✅ This appends it at the end
    // For the second section (video column)
    tempDiv.innerHTML = newColumn.trim();
    const newVideoCol = tempDiv.firstChild;
    document.getElementById("rowMain").appendChild(newVideoCol);
    tempDiv.innerHTML = thirdCloumn.trim();
    const newIframeCol = tempDiv.firstChild;
    document.getElementById("rowMain").appendChild(newIframeCol);

    // Call additional function for ICE candidates (if needed)
    collectionIceCandidateInfo();
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

    // Get media stream (video)
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
    });

    // Add video tracks to the peer connection
    stream
      .getTracks()
      .forEach((track) => peerConnection.addTrack(track, stream));

    // Display driver's own video (optional, for preview)
    const localVideo = document.getElementById("driverVideo");
    localVideo.srcObject = stream;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", {
          bus, // Send bus ID along with candidate
          candidate: event.candidate,
        });
      }
    };

    // Create and send the offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit("driver-offer", {
      bus,
      offer,
    });
  }

  // When the admin sends an answer to the driver (bus), set it as remote description
  socket.on("admin-answer", ({ offer }) => {
    peerConnection
      .setRemoteDescription(new RTCSessionDescription(offer))
      .catch((error) =>
        console.error("Error setting remote description:", error)
      );
  });
  socket.on("ice-candidate", ({ busId, candidate }) => {
    console.log("admin ice candidate Asnwer received");
    if (peerConnection) {
      // Add the candidate to the peer connection
      peerConnection
        .addIceCandidate(new RTCIceCandidate(candidate))
        .catch((error) => console.error("Error adding ICE candidate:", error));
    }
  });

  socket.on("refresh", ({ bus }) => {
    console.log("Admin disconnected, refreshing video stream...");

    // Reconnect (restart the stream)
    collectionIceCandidateInfo(); // re-initiate the connection
  });

  // Caputuring the media in chunks and sending  to ther server go tit
}, 1000);