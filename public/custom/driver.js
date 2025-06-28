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

  socket.on("connect_error", (err) => {
    console.error("❌ कनेक्शन त्रुटि:", err.message);

    if (err.message === "Missing auth token") {
      alert(
        "⚠️ आपका सत्र समाप्त हो गया है या टोकन अमान्य है। कृपया दोबारा लॉगिन करें।"
      );
    } else if (err.message === "Invalid token") {
      alert("🚫 अधिकृत टोकन नहीं मिला। पहुँच अस्वीकृत।");
    } else {
      console.log("❌ कनेक्शन विफल: " + err.message);
    }
  });

  // Disconnection Reason

  socket.on("disconnectReason", (msg) => {
    customDisconnectReason = msg;

    if (msg === "duplicate_connection") {
      window._wasManuallyRejected = true; // use this flag if needed
    }
  });

  socket.on("disconnect", (reason) => {
    const isHidden = document.visibilityState === "hidden";
    console.log("🔌 Disconnected. Reason:", reason, "| Tab Hidden?", isHidden);

    // Case 1: Automatic network drop or ping timeout
    if (reason === "ping timeout" || reason === "transport close") {
      console.log("showing  reconnection UI");
      showReconnectingUI();
      return;
    }

    // Case 2: You were manually kicked, but tab was in background
    if (reason === "io server disconnect" && isHidden) {
      showReconnectingUI();
      document.addEventListener(
        "visibilitychange",
        () => {
          if (document.visibilityState === "visible") {
            window.location.reload();
          }
        },
        { once: true }
      );
      return;
    }

    // Case 3: Tab is active and server disconnected
    if (reason === "io server disconnect" && !isHidden) {
      if (window._wasManuallyRejected) {
        connectionDenied(); // ❌ Show "you were rejected" UI
      } else {
        // 🟢 Page was visible but kicked without a known reason — refresh to restart
        showReconnectingUI();
        setTimeout(() => {
          window.location.reload();
        }, 3000); // Give a short delay before reloading
      }
      return;
    }

    // Case 4: Client itself disconnected intentionally
    if (reason === "io client disconnect") return;
  });

  function showReconnectingUI() {
    console.log("showing reconnection UI");

    const col = `
      <div class="container">
        <p>🔄 कनेक्ट किया जा रहा है... कृपया प्रतीक्षा करें।</p>
      </div>
    `;

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = col.trim();
    const newCol = tempDiv.firstChild;

    const mainRow = document.getElementById("mainRow");

    if (mainRow) {
      mainRow.innerHTML = "";
      mainRow.appendChild(newCol);
    } else {
      console.warn("⚠️ mainRow element not found!");
    }
  }

  window.addEventListener("beforeunload", (e) => {
    if (socket && socket.connected) {
      socket.disconnect();
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
  🚫 यह बस पहले से ही किसी अन्य डिवाइस से लाइव है।<br /><br />
  संभवतः कोई और ड्राइवर या हेल्पर इस बस की लोकेशन पहले से भेज रहा है।<br /><br />
  👉 कृपया थोड़ी देर बाद फिर से प्रयास करें,<br />
  या सुनिश्चित करें कि कोई और इस समय लोकेशन शेयर नहीं कर रहा हो।
</p>

      <div class="template-demo">
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC" style="text-decoration: none; color: inherit;">वापस जाएँ</a>
        </button>

          <!-- Retry Button -->
  <button type="button" class="btn btn-primary btn-fw" onclick="location.reload()">
    🔁 फिर से प्रयास करें
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
        बस की लोकेशन साझा करना बंद करने के लिए कृपया <code>चेक्ड आउट (Checked Out)</code> बटन पर क्लिक करें।
      </p>
      <div class="template-demo">
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC" style="text-decoration: none; color: black;">चेक्ड आउट</a>
        </button>
        <button type="button" class="btn btn-secondary btn-fw">
          <a href="/DC/startStream" style="text-decoration: none; color: black;">स्ट्रीमिंग शुरू करें</a>
        </button>
      </div>
    </div>
  </div>
</div>

  `;
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
    document.getElementById("mainRow").appendChild(newIframeCol);
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
}, 2000);
