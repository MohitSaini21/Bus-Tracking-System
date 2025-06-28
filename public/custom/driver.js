setTimeout(() => {
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
      if (socket) {
        socket.emit("busLocationUpdate", locationData);
      } else {
        buildConnection();
      }
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

      connectionDenied(`📡 GPS त्रुटि: ${message}\n\n📌 सुझाव: ${suggestion}`);

      safeSpeakHindi(suggestion); // 🔊 Optional TTS
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5 * 60 * 1000, // 5 मिनट पुरानी लोकेशन तक मान्य
      timeout: 10000, // 10 सेकंड तक इंतजार करेगा
    }
  );
}, 3000);

let socket = null;
function buildConnection() {
  socket = io({
    reconnection: false, // ❌ Do not try to reconnect
    timeout: 20000, // Optional: still wait 20s for initial connection
    query: {
      role: user.role,
      liveBusId: bus._id,
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
      console.log("कनेक्शन विफल: " + err.message);
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

    if (reason === "io client disconnect") {
      console.log("ℹ️ Client disconnected intentionally.");
    } else if (reason === "ping timeout" || reason === "transport close") {
      const message = isHidden
        ? "आपकी टैब पृष्ठभूमि में थी, जिससे कनेक्शन बंद हो गया।"
        : "नेटवर्क समस्या या लंबे समय तक निष्क्रियता के कारण कनेक्शन टूट गया।";

      showReconnectingUI(message);

      // Reload immediately or on visibilitychange depending on context
      if (isHidden) {
        document.addEventListener(
          "visibilitychange",
          () => {
            if (document.visibilityState === "visible") {
              window.location.reload();
            }
          },
          { once: true }
        );
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      }
    } else if (reason === "io server disconnect") {
      if (window._wasManuallyRejected) {
        connectionDenied();
      } else {
        const msg = isHidden
          ? "जब आप दूसरी टैब पर थे, तब कनेक्शन बंद कर दिया गया।"
          : "आपको सर्वर से डिस्कनेक्ट कर दिया गया। फिर से प्रयास किया जा रहा है...";

        showReconnectingUI(msg);

        if (isHidden) {
          document.addEventListener(
            "visibilitychange",
            () => {
              if (document.visibilityState === "visible") {
                window.location.reload();
              }
            },
            { once: true }
          );
        } else {
          setTimeout(() => {
            window.location.reload();
          }, 3000);
        }
      }
    } else {
      showReconnectingUI("❓ अज्ञात कारण से कनेक्शन टूट गया।");
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    }
  });
  

  /**
   * Displays a reconnection UI message to the user with a given error reason.
   *
   * @param {string} errorMesg - The error message to display under the reconnection notice.
   */
  function showReconnectingUI(errorMesg = "सर्वर से कनेक्शन टूट गया है।") {
    console.log("🔁 Reconnection UI is being shown...");

    // HTML content for reconnection message
    const col = `
    <div class="container text-center" style="margin-top: 40px;">
      <div class="alert alert-warning" role="alert" style="font-size: 1.1rem;">
        🔄 कनेक्ट किया जा रहा है... कृपया प्रतीक्षा करें।
      </div>
      <div class="alert alert-danger" role="alert" style="font-size: 0.95rem;">
        ❌ ${errorMesg}
      </div>
    </div>
  `;

    // Create the DOM node
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = col.trim();
    const newCol = tempDiv.firstChild;

    // Find the main container
    const mainRow = document.getElementById("mainRow");

    // Inject the content
    if (mainRow) {
      mainRow.innerHTML = "";
      mainRow.appendChild(newCol);
    } else {
      console.warn("⚠️ 'mainRow' container not found in DOM.");
    }
  }

  window.addEventListener("beforeunload", (e) => {
    if (socket && socket.connected) {
      socket.disconnect();
    }
  });

  function connectionDenied(
    message = "🚫 यह बस पहले से ही किसी अन्य डिवाइस से लाइव है।<br /><br />संभवतः कोई और ड्राइवर या हेल्पर इस बस की लोकेशन पहले से भेज रहा है।<br /><br />👉 कृपया थोड़ी देर बाद फिर से प्रयास करें,<br />या सुनिश्चित करें कि कोई और इस समय लोकेशन शेयर नहीं कर रहा हो।"
  ) {
    const col = `
  <div class="col-12 grid-margin stretch-card" id="goBack">
    <div class="card">
      <div class="card-body" id="cardBody">
        <h4 class="card-title">
          ${user.name} (${user.role})
        </h4>
        <p class="card-description">
          ${message}
        </p>
        <div class="template-demo">
          <button type="button" class="btn btn-secondary btn-fw">
            <a href="/DC" style="text-decoration: none; color: inherit;">वापस जाएँ</a>
          </button>
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
    document.getElementById("mainRow").appendChild(newCol);
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
}
