let socket = null;
let lastSavedTime = 0;
let previousPoint = null;

var peerConnection;
var recorder;
var chunks = [];
const iceConfig = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302", // Google STUN server
    },
    // Optionally add TURN servers here
  ],
};

function connectionDenied(
  message = "🚫 यह बस पहले से ही किसी अन्य डिवाइस से लाइव है।"
) {
  const html = `
    <div class="col-12 gri43d-margin stretch-card" id="goBack">
      <div class="card">
        <div class="card-body">
          <h4 class="card-title">${user.name} (${user.role})</h4>
          <p class="card-description">${message}</p>
          <div class="template-demo">
            <button class="btn btn-secondary btn-fw">
              <a href="/DC" style="text-decoration: none; color: inherit;">वापस जाएँ</a>
            </button>
            <button class="btn btn-primary btn-fw" onclick="window.location.href='/DC/startStream'">🔁 फिर से प्रयास करें</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const temp = document.createElement("div");
  temp.innerHTML = html.trim();

  const mainRow = document.getElementById("mainRow");
  const rowMain = document.getElementById("rowMain");
  if (rowMain) {
    rowMain.innerHTML = "";
  }
  if (mainRow) {
    mainRow.innerHTML = "";
    mainRow.appendChild(temp.firstChild);
  }
}

function saveLocation(position) {
  const currentTime = Date.now();

  const baseData = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: currentTime,
  };

  if (currentTime - lastSavedTime > 5000 && previousPoint !== null) {
    baseData.previousPoint = previousPoint;
    previousPoint = {
      latitude: baseData.latitude,
      longitude: baseData.longitude,
    };
    lastSavedTime = currentTime;
  } else if (previousPoint === null) {
    previousPoint = {
      latitude: baseData.latitude,
      longitude: baseData.longitude,
    };
    lastSavedTime = currentTime;
  }

  return baseData;
}
setTimeout(() => {
  navigator.geolocation.watchPosition(
    async (position) => {
      const locationData = saveLocation(position);
      locationData.bus = bus;

      console.log("✅ Emitting Live Location:", locationData);

      if (socket && socket.connected) {
        socket.emit("busLocationUpdate", locationData);
      } else {
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          if (stream) {
            buildConnection();
          }
        } catch (error) {
          console.error("📷 Media Permission Error:", error.message);
          const msg =
            "📷 कैमरा एक्सेस की अनुमति नहीं दी गई। कृपया अनुमति देकर फिर से प्रयास करें।";
          connectionDenied(msg);
          safeSpeakHindi(msg);

          return;
        }
      }
    },
    (error) => {
      const errorMessages = {
        1: {
          message:
            "❌ अनुमति अस्वीकृत: उपयोगकर्ता ने वेबसाइट को लोकेशन एक्सेस की अनुमति नहीं दी।",
          suggestion: "कृपया वेबसाइट को लोकेशन अनुमति दें।",
        },
        2: {
          message: "❌ स्थिति अनुपलब्ध: डिवाइस लोकेशन नहीं खोज सका।",
          suggestion: "कृपया GPS ऑन करें या खुले स्थान पर जाएं।",
        },
        3: {
          message: "⌛ समय समाप्त: लोकेशन प्राप्त करने में अधिक समय लग गया।",
          suggestion: "इंटरनेट या GPS की स्थिति जांचें।",
        },
        default: {
          message: `⚠️ अज्ञात त्रुटि: ${error.message}`,
          suggestion: "कृपया डिवाइस की सेटिंग्स जांचें।",
        },
      };

      const { message, suggestion } =
        errorMessages[error.code] || errorMessages.default;

      console.error("📡 GPS Error:", error.message);

      connectionDenied(
        `📡 GPS त्रुटि: ${message}<br /><br />📌 सुझाव: ${suggestion}`
      );
      if (typeof safeSpeakHindi === "function") safeSpeakHindi(suggestion);
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    }
  );
}, 5000);

function buildConnection() {
  socket = io({
    reconnection: false,
    timeout: 20000,
    query: {
      role: user.role,
      liveBusId: bus._id,
    },
  });

  socket.on("connect_error", (err) => {
    console.error("❌ कनेक्शन त्रुटि:", err.message);
  });

  socket.on("disconnectReason", (msg) => {
    if (msg === "duplicate_connection") {
      window._wasManuallyRejected = true;
    }
  });

  socket.on("disconnect", (reason) => {
    // disconnecting peerConnection whenever disoncnection occur
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
    const isHidden = document.visibilityState === "hidden";
    console.log("🔌 Disconnected:", reason, "| Hidden?", isHidden);

    if (reason === "io client disconnect") return;

    if (reason === "ping timeout" || reason === "transport close") {
      const msg = isHidden
        ? "आपकी टैब पृष्ठभूमि में थी, जिससे कनेक्शन बंद हो गया।"
        : "नेटवर्क समस्या या लंबे समय तक निष्क्रियता के कारण कनेक्शन टूट गया।";
      return connectionDenied(msg);
    }

    if (reason === "io server disconnect") {
      if (window._wasManuallyRejected) return connectionDenied();
      const msg = isHidden
        ? "जब आप दूसरी टैब पर थे, तब कनेक्शन बंद कर दिया गया।"
        : "आपको सर्वर से डिस्कनेक्ट कर दिया गया। फिर से प्रयास किया जा रहा है...";
      return connectionDenied(msg);
    }

    connectionDenied("❓ अज्ञात कारण से कनेक्शन टूट गया।");
  });

  window.addEventListener("beforeunload", () => {
    if (socket?.connected) socket.disconnect();
  });

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

    let thirdCloumn = `<div class="col-md-12 grid-margin stretch-card" id="videoTag" style="height: 70vh;">
  <div class="card h-100">
    <div class="card-body p-0" style="height: 100%;">
      <iframe
        id="videoIframe"
        src="/locationBus/${bus._id}"
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

    tempDiv.innerHTML = thirdCloumn.trim();
    const newIframeCol = tempDiv.firstChild;
    document.getElementById("rowMain").appendChild(newIframeCol);
    // For the third section (video column)
    tempDiv.innerHTML = newColumn.trim();
    const newVideoCol = tempDiv.firstChild;
    document.getElementById("rowMain").appendChild(newVideoCol);

    // Call additional function for ICE candidates (if needed)
    collectionIceCandidateInfo();
  });

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
    if (recorder?.state === "recording") {
      recorder.stop();
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }

    // Reconnect (restart the stream)
    collectionIceCandidateInfo(); // re-initiate the connection
  });
}
