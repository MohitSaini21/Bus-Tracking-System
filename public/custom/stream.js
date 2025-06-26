var recorder;
var chunks = [];
setTimeout(() => {
  const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep trying forever
    reconnectionDelay: 3000, // Start with 3s delay
    reconnectionDelayMax: 10000,

    query: {
      role: user.role,
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
    कनेक्ट किया जा रहा है... कृपया प्रतीक्षा करें।
  </p>
</div>
`;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = col.trim();
      const newCol = tempDiv.firstChild;

      const mainRow = document.getElementById("mainRow");
      const rowMain = document.getElementById("rowMain");
      rowMain.innerHTML = " ";

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
  या तो आपको अनुमति नहीं है, या फिर आपका हेल्पर पहले से ही इस बस की लोकेशन शेयर कर रहा है।
</p>
      <div class="template-demo">
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC" style="text-decoration: none; color: inherit;">वापस जाएँ</a>
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
        ${user.name} (${user.role})
      </h4>
      <p class="card-description">
        बस की लोकेशन शेयरिंग बंद करने के लिए कृपया <code>चेक्ड आउट</code> बटन पर क्लिक करें।
      </p>
      <div class="template-demo">
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC" style="text-decoration: none; color: inherit;">चेक्ड आउट</a>
        </button>
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC/goLive" style="text-decoration: none; color: inherit;">स्ट्रीमिंग बंद करें</a>
        </button>

        
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
    <div class="card-body p-0"> <!-- Remove padding for full container usage -->
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

  let lastSavedTime = 0;
  let previousPoint = null;

  const saveLocation = (position) => {
    const currentTime = Date.now();

    if (currentTime - lastSavedTime > 5000 && previousPoint !== null) {
      // 5 second ho gaye, aur previousPoint available hai
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: currentTime,
        previousPoint,
      };

      // Update previousPoint for next call
      previousPoint = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      lastSavedTime = currentTime;
      return locationData;
    } else {
      // Pehli baar ya 5 second se kam, bina previousPoint ke
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: currentTime,
      };

      // Pehli baar yahan pe previousPoint ko set kar rahe hain
      if (previousPoint === null) {
        previousPoint = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        lastSavedTime = currentTime; // also set lastSavedTime first time
      }

      return locationData;
    }
  };
  navigator.geolocation.watchPosition(
    (position) => {
      let locationData = saveLocation(position);
      locationData["bus"] = bus;

      console.log("✅ Emitting Live Location:", locationData);
      socket.emit("busLocationUpdate", locationData);
    },
    (error) => {
      let message = "";
      let suggestion = "";

      switch (error.code) {
        case error.PERMISSION_DENIED:
          message =
            "❌ अनुमति अस्वीकृत: उपयोगकर्ता ने वेबसाइट को लोकेशन एक्सेस की अनुमति नहीं दी।";
          suggestion = "कृपया वेबसाइट को लोकेशन अनुमति दें।";
          break;

        case error.POSITION_UNAVAILABLE:
          message = "❌ स्थिति अनुपलब्ध: डिवाइस लोकेशन नहीं खोज सका।";
          suggestion = "कृपया GPS ऑन करें या खुले स्थान पर जाएं।";
          break;

        case error.TIMEOUT:
          message = "⌛ समय समाप्त: लोकेशन प्राप्त करने में अधिक समय लग गया।";
          suggestion = "इंटरनेट या GPS की स्थिति जांचें।";
          break;

        default:
          message = `⚠️ अज्ञात त्रुटि: ${error.message}`;
          suggestion = "कृपया डिवाइस की सेटिंग्स जांचें।";
          break;
      }

      console.error("📡 GPS Error Code:", error.code);
      console.error("📡 Detailed Error:", error.message);

      alert(`📡 GPS त्रुटि: ${message}\n\n📌 सुझाव: ${suggestion}`);
      safeSpeakHindi(suggestion); // 🔊 Optional TTS
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5 * 60 * 1000, // 5 मिनट पुरानी लोकेशन तक मान्य
      timeout: 10000, // 10 सेकंड तक इंतजार करेगा
    }
  );

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
    recorder = new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.start();
    recorder.onstop = () => {
      const completeBlob = new Blob(chunks, { type: "video/webm" });

      // 🔽 एक random filename (timestamp-based)
      const fileName = `busStream(${
        user.assignedBus.busNumber
      })_${Date.now()}.webm`;

      // 🔗 Blob को डाउनलोड लिंक में बदलो
      const url = URL.createObjectURL(completeBlob);

      // ⬇️ Auto-download के लिए anchor टैग बनाओ
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName; // फाइल का नाम सेट करो
      document.body.appendChild(a);
      a.click();

      // 🧹 साफ-सफाई
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    };

    // ✅ Stop recording ONLY when page is about to refresh or close
    window.addEventListener("beforeunload", () => {
      if (recorder && recorder.state === "recording") {
        recorder.stop(); // this will trigger onstop
      }
    });

    // OPTIONAL: Also stop if user switches tab or minimizes browser
    document.addEventListener("visibilitychange", () => {
      if (
        document.visibilityState === "hidden" &&
        recorder?.state === "recording"
      ) {
        recorder.stop();
      }
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
}, 2000);
