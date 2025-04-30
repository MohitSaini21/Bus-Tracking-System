if (peerConnection.signalingState !== "stable") {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
} else {
  console.log("Already in stable state, skipping setting remote answer.");
}

navigator.mediaDevices
  .getUserMedia({ video: true, audio: true })
  .then((stream) => {
    const recorder = new MediaRecorder(stream);
    const chunks = [];

    recorder.onstart = () => {
      chunks.length = 0; // clear previous
    };

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      const completeBlob = new Blob(chunks, { type: "video/webm" });
      sendBlobToServer(completeBlob);
      stream.getTracks().forEach((track) => track.stop());
    };

    recorder.start();
    console.log("Recording started...");
    window.addEventListener("beforeunload", (e) => {
      recorder.stop();
    });
  })
  .catch((error) => {
    alert("persmiison deneided");
    console.error("Error accessing media devices:", error);
  });
async function sendBlobToServer(blob) {
  const url = "/DC/saveStreamChunks";
  if (!blob) {
    console.error("No Blob provided!");
    alert("No video data available to upload.");
    return;
  }

  const formData = new FormData();
  formData.append("file", blob, "busStreamVideo");

  try {
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error("Failed to upload stream");
    }

    const data = await response.json();
    if (data.success) {
      alert("Everything is in perfect working order!");
    } else {
      alert(data.message || "Something went wrong!");
    }
  } catch (error) {
    console.error("Error during the request:", error);
    alert("An error occurred while sending the file. Please try again later.");
  }
}
