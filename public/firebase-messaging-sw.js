// public/firebase-messaging-sw.js

// Import the Firebase scripts using the old, non-modular version
importScripts("https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js");
importScripts(
  "https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js"
);

// Firebase configuration (same as in your main app)
const firebaseConfig = {
  apiKey: "AIzaSyDfyHneVzjGlqXkrwomNsHTVUx5hTJ4kaw",
  authDomain: "mywebapp-d7222.firebaseapp.com",
  projectId: "mywebapp-d7222",
  storageBucket: "mywebapp-d7222.firebasestorage.app",
  messagingSenderId: "37563411529",
  appId: "1:37563411529:web:6c3209e5613ad72603a398",
  measurementId: "G-TTGWTY9B2J",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Messaging
const messaging = firebase.messaging();

// // Handle background messages
// messaging.onBackgroundMessage((payload) => {
//   console.log("Received background message ", payload);

//   // Customize your notification here
//   const notificationTitle = "New Notification!";
//   const notificationOptions = {
//     body: payload.notification.body,
//     icon: "/firebase-logo.png", // Optional icon
//   };

//   // Show notification
//   self.registration.showNotification(notificationTitle, notificationOptions);
// });
