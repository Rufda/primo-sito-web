// File di configurazione per l'applicazione
// Questo file deve essere caricato prima di qualsiasi altro script

// Controllo per evitare ridichiarazione della variabile firebaseConfig
if (typeof firebaseConfig === 'undefined') {
    // Configurazione Firebase in ambiente sicuro
    var firebaseConfig = {
        apiKey: "AIzaSyC6nZVPaWXtgjWOP8veInKk6Omkp5vEXbI",
        authDomain: "primo-sito-web1.firebaseapp.com",
        databaseURL: "https://primo-sito-web1-default-rtdb.firebaseio.com",
        projectId: "primo-sito-web1",
        storageBucket: "primo-sito-web1.firebasestorage.app",
        messagingSenderId: "939095326009",
        appId: "1:939095326009:web:9447f09ea845600ac7bce8"
    };
}

// Controllo per evitare ridichiarazione di geminiConfig
if (typeof geminiConfig === 'undefined') {
    // Configurazione Gemini AI con sintassi moderna
    var geminiConfig = {
        apiKey: "AIzaSyBcaW9wnXS8QXf7fH3eN_TK-2mNqO8pLrE",
        model: "gemini-2.0-flash", // Modello aggiornato
        temperature: 0.9,
        maxOutputTokens: 1000,
        topP: 0.9,
        topK: 40
    };
    // Endpoint per le chiamate a Gemini API
    geminiConfig.endpoint =
        `https://generativelanguage.googleapis.com/v1beta/models/${geminiConfig.model}:generateContent`;
}

// Controllo per evitare ridichiarazione di systemConfig
if (typeof systemConfig === 'undefined') {
    // Configurazione del sistema per l'AI
    var systemConfig = {
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
}