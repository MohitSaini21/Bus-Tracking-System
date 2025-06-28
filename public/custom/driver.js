let socket = null;

function connectionDenied(
  message = "🚫 यह बस पहले से ही किसी अन्य डिवाइस से लाइव है।"
) {
  const html = `
    <div class="col-12 grid-margin stretch-card" id="goBack">
      <div class="card">
        <div class="card-body">
          <h4 class="card-title">${user.name} (${user.role})</h4>
          <p class="card-description">${message}</p>
          <div class="template-demo">
            <button class="btn btn-secondary btn-fw">
              <a href="/DC" style="text-decoration: none; color: inherit;">वापस जाएँ</a>
            </button>
            <button class="btn btn-primary btn-fw" onclick="window.location.href='/DC/goLive'">🔁 फिर से प्रयास करें</button>
          </div>
        </div>
      </div>
    </div>
  `;

  const temp = document.createElement("div");
  temp.innerHTML = html.trim();

  const mainRow = document.getElementById("mainRow");
  if (mainRow) {
    mainRow.innerHTML = "";
    mainRow.appendChild(temp.firstChild);
  }

  // Optional: Auto-redirect after 10 seconds
  setTimeout(() => {
    window.location.href = "/DC/goLive";
  }, 10000);
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

let lastSavedTime = 0;
let previousPoint = null;

setTimeout(() => {
  navigator.geolocation.watchPosition(
    (position) => {
      const locationData = saveLocation(position);
      locationData.bus = bus;

      console.log("✅ Emitting Live Location:", locationData);

      if (socket) {
        socket.emit("busLocationUpdate", locationData);
      } else {
        buildConnection();
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
      maximumAge: 5 * 60 * 1000,
      timeout: 15000,
    }
  );
}, 3000);

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
    alert("⚠️ कनेक्शन असफल: " + err.message);
  });

  socket.on("disconnectReason", (msg) => {
    if (msg === "duplicate_connection") {
      window._wasManuallyRejected = true;
    }
  });

  socket.on("disconnect", (reason) => {
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

  socket.on("connectionApproved", () => {
    const uiHTML = `
      <div class="col-12 grid-margin stretch-card" id="goAhead">
        <div class="card">
          <div class="card-body">
            <h4 class="card-title">${user.name} (${user.role})</h4>
            <p class="card-description">बस की लोकेशन साझा करना बंद करने के लिए कृपया <code>चेक्ड आउट</code> बटन पर क्लिक करें।</p>
            <div class="template-demo">
              <button class="btn btn-secondary btn-fw"><a href="/DC" style="text-decoration: none; color: black;">चेक्ड आउट</a></button>
              <button class="btn btn-secondary btn-fw"><a href="/DC/startStream" style="text-decoration: none; color: black;">स्ट्रीमिंग शुरू करें</a></button>
            </div>
          </div>
        </div>
      </div>
      <div class="col-md-12 grid-margin stretch-card" id="videoTag" style="height: 70vh;">
        <div class="card h-100"><div class="card-body p-0" style="height: 100%;">
          <iframe id="videoIframe" src="/locationBus/${bus._id}" frameborder="0" style="width: 100%; height: 100%;" allow="autoplay; fullscreen"></iframe>
        </div></div>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = uiHTML.trim();
    const mainRow = document.getElementById("mainRow");
    if (mainRow) {
      mainRow.innerHTML = "";
      tempDiv.childNodes.forEach((el) => mainRow.appendChild(el));
    }
  });
}
