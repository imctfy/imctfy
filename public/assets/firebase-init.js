/* firebase-init.js — modul Firebase asli dari <head> index.html (dipindah byte-exact). */
        import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
        import { getFirestore, doc, setDoc, getDocs, collection, increment, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
        const firebaseConfig = {
            apiKey: "AIzaSyATWmme05sKVI2qCPWvdVP5NFHIQ64eJ-o",
            authDomain: "pusat-link-cattfly.firebaseapp.com",
            databaseURL: "https://pusat-link-cattfly-default-rtdb.firebaseio.com",
            projectId: "pusat-link-cattfly",
            storageBucket: "pusat-link-cattfly.firebasestorage.app",
            messagingSenderId: "37808781852",
            appId: "1:37808781852:web:35e5b9d4f1776065bdbdd9",
            measurementId: "G-15SJYB7TNN"
        };
        try {
            const app = initializeApp(firebaseConfig);
            const db = getFirestore(app);
            window.__fb = { db, doc, setDoc, getDocs, collection, increment, onSnapshot, ready: true };
            window.__fb_ready = true;
        } catch(e) {
            console.warn('Firebase init:', e);
            window.__fb = { ready: false };
            window.__fb_ready = true;
        }
        window.dispatchEvent(new Event('fb-ready'));
