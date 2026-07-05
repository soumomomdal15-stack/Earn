// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB6VmvDtFKYLgW9C_9WE-YoE3LNh19_utk",
  authDomain: "earnos-780db.firebaseapp.com",
  projectId: "earnos-780db",
  storageBucket: "earnos-780db.firebasestorage.app",
  messagingSenderId: "469051623753",
  appId: "1:469051623753:web:397a832378de1663603298",
  measurementId: "G-FC5ZR50LEQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
