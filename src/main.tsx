import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initializeApp, getApps } from "firebase/app"; // getApps इम्पोर्ट करें

const firebaseConfig = {
  apiKey: "AIzaSyB6VmvDtFKYLgW9C_9WE-YoE3LNh19_utk",
  authDomain: "earnos-780db.firebaseapp.com",
  projectId: "earnos-780db",
  storageBucket: "earnos-780db.firebasestorage.app",
  messagingSenderId: "469051623753",
  appId: "1:469051623753:web:397a832378de1663603298"
};

// यहाँ एक चेक लगा रहे हैं कि अगर ऐप पहले से चालू नहीं है, तभी चालू करें
if (!getApps().length) {
  initializeApp(firebaseConfig);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
