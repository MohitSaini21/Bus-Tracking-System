setTimeout(() => {
  const socket = io({
    reconnection: true,
    reconnectionAttempts: Infinity, // Keep trying forever
    reconnectionDelay: 3000, // Start with 3s delay
    reconnectionDelayMax: 10000,
    query: {
      liveBusId: bus._id, // Convert the _id to a string (if it’s a MongoDB ObjectId)
    },
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
         
         Either you are not authorized to provide location again, or another mate is currently tracking this bus;
           
              
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
              <button type="button" class="btn btn-secondary btn-fw"><a href="  /DC/startStream">Start Streaming </a></button>
                      
             
                      
                    </div>
                  </div>
     
                  
     
                  
         
                  
                </div>
              </div>
  `;
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

      console.log("Emitting Live Location:", locationData);
      socket.emit("busLocationUpdate", locationData);
    },
    (error) => {
      console.error("GPS Error:", error.message);
      console.log("Sending Nothing");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 5 * 60 * 1000, // Max 5 min purani location accept karega
      timeout: 10000, // 10 sec tak fresh location ka wait karega
    }
  );
}, 1000);
