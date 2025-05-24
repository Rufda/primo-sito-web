// File di configurazione per l'applicazione
// Questo file deve essere caricato prima di qualsiasi altro script

// Configurazione Firebase in ambiente sicuro
const firebaseConfig = {
    apiKey: "AIzaSyC6nZVPaWXtgjWOP8veInKk6Omkp5vEXbI",
    authDomain: "primo-sito-web1.firebaseapp.com",
    databaseURL: "https://primo-sito-web1-default-rtdb.firebaseio.com",
    projectId: "primo-sito-web1",
    storageBucket: "primo-sito-web1.firebasestorage.app",
    messagingSenderId: "939095326009",
    appId: "1:939095326009:web:9447f09ea845600ac7bce8"
};

// Configurazione Gemini AI ottimizzata per l'assistente avanzato
const geminiConfig = {
    apiKey: "AIzaSyBcaW9wnXS8QXf7fH3eN_TK-2mNqO8pLrE",
    model: "gemini-1.5-flash",
    endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
    temperature: 0.9, // Più creatività per risposte naturali
    maxOutputTokens: 1000, // Più spazio per risposte dettagliate
    topP: 0.9,
    topK: 40
};

// Configurazione del sistema per l'AI
const systemConfig = {
    businessName: "Centro Estetico Miller",
    businessAddress: "Via Roma 123, Milano",
    businessPhone: "02 1234567",
    businessEmail: "info@centromiller.com",
    businessHours: "Lun-Ven 9:00-18:00, Sab 9:00-13:00",
    services: [
        "Trattamenti viso",
        "Massaggi rilassanti",
        "Manicure e pedicure",
        "Depilazione",
        "Trattamenti corpo"
    ],
    policies: {
        cancellation: "Cancellazione gratuita fino a 24h prima",
        deposit: "Non richiesto deposito",
        lateness: "Ritardi oltre 15 minuti = cancellazione automatica"
    }
};