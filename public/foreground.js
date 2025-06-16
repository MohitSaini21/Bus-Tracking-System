import { initializeApp } from "https://www.gstatic.com/firebasejs/9.0.2/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.0.2/firebase-analytics.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/9.0.2/firebase-messaging.js";
// Firebase config (your configuration keys)
const firebaseConfig = {
  apiKey: "AIzaSyDfyHneVzjGlqXkrwomNsHTVUx5hTJ4kaw",
  authDomain: "mywebapp-d7222.firebaseapp.com",
  projectId: "mywebapp-d7222",
  storageBucket: "mywebapp-d7222.firebasestorage.app",
  messagingSenderId: "37563411529",
  appId: "1:37563411529:web:6c3209e5613ad72603a398",
  measurementId: "G-TTGWTY9B2J",
};

const app = initializeApp(firebaseConfig);

const messaging = getMessaging(app);
onMessage(messaging, (payload) => {
  console.log("Foreground message received:", payload);

  if (payload && payload.notification) {
    const { title, body } = payload.notification;

    // ✅ Formal message creation
    const formattedMessage = `🔔 ${title}\n\n${body}\n\nकृपया तुरंत ध्यान दें।`;

    // ✅ Show using alert
    alert(formattedMessage);
  } else {
    console.log("Message received, but no notification data found.");
  }
});
