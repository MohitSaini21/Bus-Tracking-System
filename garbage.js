
if (peerConnection.signalingState !== "stable") {
  peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
} else {
  console.log("Already in stable state, skipping setting remote answer.");
}