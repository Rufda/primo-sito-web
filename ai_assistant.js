/**
 * AI Assistant Script - Versione completamente integrata con Gemini AI
 * L'AI può eseguire tutte le operazioni del sistema tramite API calls
 */

// Importazioni Firebase (si attivano solo se Firebase è già caricato)
let db, auth, currentUser, isAdmin = false;
let firebaseReady = false;
let disponibilitaData = {};
let prenotazioniData = [];

// Configurazione Gemini AI
let geminiAPI = null;
let isGeminiReady = false;
let lastApiCallTime = 0;
const MIN_API_CALL_INTERVAL = 1000;

// Inizializza la configurazione Gemini AI
function initializeGeminiAPI() {
    console.log("AI Assistant: Initializing Gemini API...");
    if (typeof geminiConfig !== 'undefined' && geminiConfig.apiKey) {
        geminiAPI = {
            apiKey: geminiConfig.apiKey,
            model: geminiConfig.model || "gemini-1.5-flash",
            endpoint: geminiConfig.endpoint,
            temperature: geminiConfig.temperature || 0.9,
            maxOutputTokens: geminiConfig.maxOutputTokens || 1000
        };
        isGeminiReady = true;
        console.log("Gemini AI configurato e pronto!");
    } else {
        console.error("Configurazione Gemini mancante! L'assistente non funzionerà.");
        isGeminiReady = false;
    }
}

// Sistema di funzioni disponibili per l'AI
const availableFunctions = {
    // Funzioni per le disponibilità
    getAvailableSlots: async (date = null) => {
        if (!disponibilitaData) return [];
        
        const slots = [];
        const dates = date ? [date] : Object.keys(disponibilitaData).sort();
        
        for (const dateKey of dates) {
            const daySlots = disponibilitaData[dateKey];
            if (daySlots) {
                for (const slotId in daySlots) {
                    const slot = daySlots[slotId];
                    if (slot.isActive && !slot.isBooked) {
                        const [hours, minutes] = slot.startTime.split(':');
                        const slotDateTime = new Date(dateKey);
                        slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        
                        if (slotDateTime > new Date()) {
                            slots.push({
                                id: slotId,
                                date: dateKey,
                                startTime: slot.startTime,
                                endTime: slot.endTime,
                                description: slot.description || ''
                            });
                        }
                    }
                }
            }
        }
        return slots.slice(0, 10); // Limita a 10 risultati
    },

    addAvailability: async (date, startTime, endTime, description = '') => {
        if (!isAdmin) throw new Error("Operazione non autorizzata");
        
        try {
            const dateRef = window.firebaseWrapper.ref(`disponibilita/${date}`);
            const newSlotRef = await window.firebaseWrapper.push(dateRef, {
                startTime,
                endTime,
                description,
                isActive: true,
                isBooked: false
            });
            return { success: true, id: newSlotRef.key };
        } catch (error) {
            throw new Error(`Errore nell'aggiunta: ${error.message}`);
        }
    },

    removeAvailability: async (date, startTime) => {
        if (!isAdmin) throw new Error("Operazione non autorizzata");
        
        const slots = disponibilitaData[date];
        if (!slots) throw new Error("Nessuna disponibilità trovata per questa data");
        
        let slotIdToRemove = null;
        for (const id in slots) {
            if (slots[id].startTime === startTime) {
                slotIdToRemove = id;
                break;
            }
        }
        
        if (!slotIdToRemove) throw new Error("Slot non trovato");
        
        try {
            const slotRef = window.firebaseWrapper.ref(`disponibilita/${date}/${slotIdToRemove}`);
            await window.firebaseWrapper.remove(slotRef);
            return { success: true };
        } catch (error) {
            throw new Error(`Errore nella rimozione: ${error.message}`);
        }
    },

    // Funzioni per le prenotazioni
    createBooking: async (slotId, date, startTime, endTime, customerName, customerEmail, customerPhone = '', notes = '') => {
        if (!currentUser) throw new Error("Devi essere autenticato per prenotare");
        
        // Verifica che lo slot sia ancora disponibile
        const slots = disponibilitaData[date];
        if (!slots || !slots[slotId] || slots[slotId].isBooked) {
            throw new Error("Slot non più disponibile");
        }
        
        try {
            const bookingData = {
                id: null,
                name: customerName,
                email: customerEmail,
                phone: customerPhone,
                notes: notes,
                userId: currentUser.uid,
                userEmail: currentUser.email,
                timestamp: new Date().toISOString(),
                slotId: slotId,
                date: date,
                startTime: startTime,
                endTime: endTime,
                status: 'confirmed'
            };

            const bookingRef = window.firebaseWrapper.ref('prenotazioni').push();
            bookingData.id = bookingRef.key;

            await bookingRef.set(bookingData);
            
            // Marca lo slot come prenotato
            await window.firebaseWrapper.ref(`disponibilita/${date}/${slotId}`)
                .update({ isBooked: true, bookingId: bookingData.id });

            return { success: true, bookingId: bookingData.id, bookingData };
        } catch (error) {
            throw new Error(`Errore nella prenotazione: ${error.message}`);
        }
    },

    getUserBookings: async (userId = null) => {
        const targetUserId = userId || (currentUser ? currentUser.uid : null);
        if (!targetUserId) throw new Error("Utente non identificato");
        
        return prenotazioniData.filter(booking => booking.userId === targetUserId);
    },

    getAllBookings: async (date = null) => {
        if (!isAdmin) throw new Error("Operazione non autorizzata");
        
        if (date) {
            return prenotazioniData.filter(booking => booking.date === date);
        }
        return prenotazioniData;
    },

    cancelBooking: async (bookingId) => {
        const booking = prenotazioniData.find(b => b.id === bookingId);
        if (!booking) throw new Error("Prenotazione non trovata");
        
        // Verifica autorizzazioni
        if (!isAdmin && booking.userId !== currentUser?.uid) {
            throw new Error("Non autorizzato a cancellare questa prenotazione");
        }
        
        try {
            // Rimuovi prenotazione
            await window.firebaseWrapper.ref(`prenotazioni/${bookingId}`).remove();
            
            // Libera lo slot
            await window.firebaseWrapper.ref(`disponibilita/${booking.date}/${booking.slotId}`)
                .update({ isBooked: false, bookingId: null });
                
            return { success: true };
        } catch (error) {
            throw new Error(`Errore nella cancellazione: ${error.message}`);
        }
    },

    // Funzioni di utilità
    getCurrentUser: () => {
        return currentUser ? {
            uid: currentUser.uid,
            email: currentUser.email,
            displayName: currentUser.displayName,
            isAdmin: isAdmin
        } : null;
    },

    getSystemStats: async () => {
        if (!isAdmin) throw new Error("Operazione non autorizzata");
        
        const today = new Date().toISOString().split('T')[0];
        const totalBookings = prenotazioniData.length;
        const todaysBookings = prenotazioniData.filter(b => b.date === today).length;
        const availableSlots = await availableFunctions.getAvailableSlots();
        
        return {
            totalBookings,
            todaysBookings,
            availableSlotsCount: availableSlots.length,
            isAdmin: isAdmin
        };
    }
};

// Funzione principale per chiamare Gemini AI con accesso alle funzioni del sistema
async function callGeminiAIWithSystemAccess(prompt, context = {}) {
    if (!isGeminiReady) {
        throw new Error("Gemini AI non configurato");
    }
    
    // Limita frequenza chiamate API
    const now = Date.now();
    if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_API_CALL_INTERVAL - (now - lastApiCallTime)));
    }
    lastApiCallTime = Date.now();
    
    // Prepara il contesto completo del sistema
    const currentPage = window.location.pathname.split("/").pop() || "home";
    const systemContext = await prepareSystemContext();
    
    const systemPrompt = `Sei Miller AI, l'assistente virtuale avanzato di un centro estetico/benessere.
Hai accesso completo al sistema e puoi eseguire TUTTE le operazioni richieste dall'utente.

INFORMAZIONI SISTEMA:
- Utente corrente: ${systemContext.currentUser ? `${systemContext.currentUser.email} (${systemContext.currentUser.isAdmin ? 'Admin' : 'Cliente'})` : 'Non autenticato'}
- Pagina: ${currentPage}
- Disponibilità totali: ${systemContext.availableSlotsCount}
- Prenotazioni totali: ${systemContext.totalBookings}
- Prenotazioni oggi: ${systemContext.todaysBookings}

FUNZIONI DISPONIBILI:
${Object.keys(availableFunctions).map(func => `- ${func}`).join('\n')}

COMPORTAMENTO:
1. Analizza la richiesta dell'utente
2. Se richiede un'azione, ESEGUILA usando le funzioni disponibili
3. Fornisci una risposta naturale e completa
4. Se l'azione fallisce, spiega il motivo e suggerisci alternative

ISTRUZIONI SPECIALI:
- Per le prenotazioni, richiedi SEMPRE nome, email (se non autenticato)
- Mostra sempre i dettagli delle azioni eseguite
- Sii proattivo nel suggerire azioni correlate
- Se l'utente non è autenticato per certe operazioni, spiegaglielo
- Formatta bene date e orari (formato italiano)

Richiesta utente: ${prompt}`;

    try {
        let retries = 3;
        let delay = 1000;
        let lastError = null;
        
        while (retries > 0) {
            try {
                const response = await fetch(geminiAPI.endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': geminiAPI.apiKey
                    },
                    body: JSON.stringify({
                        contents: [{
                            parts: [{
                                text: systemPrompt
                            }]
                        }],
                        generationConfig: {
                            temperature: geminiAPI.temperature,
                            maxOutputTokens: geminiAPI.maxOutputTokens,
                            topP: 0.9,
                            topK: 40
                        },
                        safetySettings: [
                            {
                                category: "HARM_CATEGORY_HARASSMENT",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            },
                            {
                                category: "HARM_CATEGORY_HATE_SPEECH",
                                threshold: "BLOCK_MEDIUM_AND_ABOVE"
                            }
                        ]
                    })
                });

                if (!response.ok) {
                    throw new Error(`Errore API Gemini: ${response.status}`);
                }

                const data = await response.json();
                
                if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                    const aiResponse = data.candidates[0].content.parts[0].text;
                    
                    // Analizza se l'AI ha richiesto l'esecuzione di funzioni
                    const actionResult = await executeAIActions(aiResponse, prompt);
                    
                    return actionResult.response || aiResponse;
                } else {
                    throw new Error("Risposta API non valida");
                }
            } catch (error) {
                lastError = error;
                retries--;
                if (retries > 0) {
                    await new Promise(r => setTimeout(r, delay));
                    delay *= 2;
                }
            }
        }
        
        throw lastError || new Error("Errore sconosciuto nella chiamata API");
    } catch (error) {
        console.error("Errore chiamata Gemini API:", error);
        throw error;
    }
}

// Prepara il contesto completo del sistema per l'AI
async function prepareSystemContext() {
    const context = {
        currentUser: availableFunctions.getCurrentUser(),
        availableSlotsCount: 0,
        totalBookings: prenotazioniData.length,
        todaysBookings: 0,
        recentSlots: []
    };
    
    try {
        const availableSlots = await availableFunctions.getAvailableSlots();
        context.availableSlotsCount = availableSlots.length;
        context.recentSlots = availableSlots.slice(0, 5);
        
        const today = new Date().toISOString().split('T')[0];
        context.todaysBookings = prenotazioniData.filter(b => b.date === today).length;
    } catch (error) {
        console.error("Errore nel preparare il contesto:", error);
    }
    
    return context;
}

// Analizza la risposta dell'AI e esegue le azioni richieste
async function executeAIActions(aiResponse, originalPrompt) {
    const lowerPrompt = originalPrompt.toLowerCase();
    const lowerResponse = aiResponse.toLowerCase();
    
    let executedActions = [];
    let finalResponse = aiResponse;
    
    try {
        // Analisi per prenotazioni
        if (lowerPrompt.includes('prenota') || lowerPrompt.includes('prenotazione') || 
            lowerPrompt.includes('appuntamento') || lowerPrompt.includes('libro')) {
            
            const bookingAction = await analyzeBookingRequest(originalPrompt);
            if (bookingAction) {
                executedActions.push(bookingAction);
            }
        }
        
        // Analisi per visualizzazione disponibilità
        if (lowerPrompt.includes('disponibil') || lowerPrompt.includes('orari') || 
            lowerPrompt.includes('quando') || lowerPrompt.includes('libero')) {
            
            const availabilityAction = await analyzeAvailabilityRequest(originalPrompt);
            if (availabilityAction) {
                executedActions.push(availabilityAction);
            }
        }
        
        // Analisi per operazioni admin
        if (isAdmin && (lowerPrompt.includes('aggiungi') || lowerPrompt.includes('rimuovi') || 
                       lowerPrompt.includes('cancella') || lowerPrompt.includes('crea'))) {
            
            const adminAction = await analyzeAdminRequest(originalPrompt);
            if (adminAction) {
                executedActions.push(adminAction);
            }
        }
        
        // Analisi per visualizzazione prenotazioni
        if (lowerPrompt.includes('mie prenotazioni') || lowerPrompt.includes('i miei appuntamenti')) {
            const userBookings = await availableFunctions.getUserBookings();
            executedActions.push({
                action: 'getUserBookings',
                result: userBookings,
                success: true
            });
        }
        
        // Se sono state eseguite azioni, aggiorna la risposta
        if (executedActions.length > 0) {
            finalResponse = await generateResponseWithActions(aiResponse, executedActions, originalPrompt);
        }
        
    } catch (error) {
        console.error("Errore nell'esecuzione delle azioni:", error);
        finalResponse += `\n\n⚠️ Si è verificato un errore nell'esecuzione: ${error.message}`;
    }
    
    return {
        response: finalResponse,
        actions: executedActions
    };
}

// Analizza richieste di prenotazione
async function analyzeBookingRequest(prompt) {
    // Pattern per estrarre informazioni di prenotazione
    const dateMatch = prompt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    const timeMatch = prompt.match(/(\d{1,2}):(\d{2})/);
    const nameMatch = prompt.match(/nome\s*[:=]?\s*([a-zA-Z\s]+)/i);
    const emailMatch = prompt.match(/email\s*[:=]?\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i);
    
    // Se non ci sono dettagli sufficienti, restituisci le disponibilità
    if (!dateMatch && !timeMatch) {
        const availableSlots = await availableFunctions.getAvailableSlots();
        return {
            action: 'getAvailableSlots',
            result: availableSlots,
            success: true
        };
    }
    
    return null; // Richiede più informazioni
}

// Analizza richieste di disponibilità
async function analyzeAvailabilityRequest(prompt) {
    const dateMatch = prompt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})|(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    
    let targetDate = null;
    if (dateMatch) {
        // Converti la data nel formato corretto
        if (dateMatch[1]) {
            // Formato gg/mm/aaaa
            targetDate = `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`;
        } else {
            // Formato aaaa/mm/gg
            targetDate = `${dateMatch[4]}-${dateMatch[5].padStart(2, '0')}-${dateMatch[6].padStart(2, '0')}`;
        }
    }
    
    const availableSlots = await availableFunctions.getAvailableSlots(targetDate);
    return {
        action: 'getAvailableSlots',
        result: availableSlots,
        success: true,
        date: targetDate
    };
}

// Analizza richieste admin
async function analyzeAdminRequest(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Aggiunta disponibilità
    if (lowerPrompt.includes('aggiungi disp')) {
        const match = prompt.match(/(\d{4}[-\/]\d{2}[-\/]\d{2}).*?(\d{2}:\d{2}).*?(\d{2}:\d{2})/);
        if (match) {
            const [, date, startTime, endTime] = match;
            const normalizedDate = date.replace(/\//g, '-');
            const description = prompt.match(/descrizione[:\s]*([^.!?]+)/i)?.[1]?.trim() || '';
            
            const result = await availableFunctions.addAvailability(normalizedDate, startTime, endTime, description);
            return {
                action: 'addAvailability',
                result: result,
                success: true,
                params: { date: normalizedDate, startTime, endTime, description }
            };
        }
    }
    
    // Rimozione disponibilità
    if (lowerPrompt.includes('rimuovi disp') || lowerPrompt.includes('cancella disp')) {
        const match = prompt.match(/(\d{4}[-\/]\d{2}[-\/]\d{2}).*?(\d{2}:\d{2})/);
        if (match) {
            const [, date, startTime] = match;
            const normalizedDate = date.replace(/\//g, '-');
            
            const result = await availableFunctions.removeAvailability(normalizedDate, startTime);
            return {
                action: 'removeAvailability',
                result: result,
                success: true,
                params: { date: normalizedDate, startTime }
            };
        }
    }
    
    return null;
}

// Genera una risposta aggiornata con i risultati delle azioni
async function generateResponseWithActions(originalResponse, actions, originalPrompt) {
    let enhancedResponse = originalResponse;
    
    for (const action of actions) {
        switch (action.action) {
            case 'getAvailableSlots':
                if (action.result.length > 0) {
                    enhancedResponse += `\n\n📅 **Disponibilità trovate:**\n`;
                    action.result.forEach(slot => {
                        enhancedResponse += `• ${slot.date} dalle ${slot.startTime} alle ${slot.endTime}`;
                        if (slot.description) enhancedResponse += ` - ${slot.description}`;
                        enhancedResponse += '\n';
                    });
                } else {
                    enhancedResponse += '\n\n❌ Nessuna disponibilità trovata per il periodo richiesto.';
                }
                break;
                
            case 'getUserBookings':
                if (action.result.length > 0) {
                    enhancedResponse += `\n\n📋 **Le tue prenotazioni:**\n`;
                    action.result.forEach(booking => {
                        enhancedResponse += `• ${booking.date} dalle ${booking.startTime} alle ${booking.endTime} - ${booking.name}\n`;
                    });
                } else {
                    enhancedResponse += '\n\n📭 Non hai prenotazioni attive al momento.';
                }
                break;
                
            case 'addAvailability':
                enhancedResponse += `\n\n✅ **Disponibilità aggiunta:** ${action.params.date} dalle ${action.params.startTime} alle ${action.params.endTime}`;
                break;
                
            case 'removeAvailability':
                enhancedResponse += `\n\n🗑️ **Disponibilità rimossa:** ${action.params.date} alle ${action.params.startTime}`;
                break;
                
            case 'createBooking':
                enhancedResponse += `\n\n🎉 **Prenotazione confermata!** ID: ${action.result.bookingId}`;
                break;
        }
    }
    
    return enhancedResponse;
}

// Verifica se Firebase è caricato e inizializza l'assistente
document.addEventListener('DOMContentLoaded', () => {
    console.log("AI Assistant: DOMContentLoaded event fired."); // LOG
    // Inizializza Gemini AI
    initializeGeminiAPI();
    
    // Variabili globali per l'assistente
    let chatbox;
    let assistantButton;
    let closeButton;
    let messagesContainer;
    let inputField;
    let sendButton;
    let suggestionsContainer;
    let confirmationCallback = null;
    let typingIndicator;

    // Inizializza Firebase (se non già fatto)
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    // Funzione per creare l'HTML dell'assistente e aggiungerlo al body
    function createAssistantUI() {
        console.log("AI Assistant: Attempting to create UI..."); // LOG
        
        // Rimuovi eventuali istanze esistenti
        const existingContainer = document.querySelector('.ai-assistant-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        // Crea il contenitore HTML per l'assistente AI
        const assistantHTML = `
            <div class="ai-assistant-container">
                <div class="ai-assistant-button">
                    🤖
                </div>
                <div class="ai-assistant-chatbox">
                    <div class="ai-assistant-header">
                        <div class="ai-assistant-header-title">
                            <div class="ai-assistant-header-logo">🤖</div>
                            <span>Miller AI</span>
                        </div>
                        <button class="ai-assistant-close">&times;</button>
                    </div>
                    <div class="ai-assistant-messages"></div>
                    <div class="ai-assistant-suggestions"></div>
                    <div class="ai-assistant-input-container">
                        <input type="text" class="ai-assistant-input" placeholder="Scrivi un messaggio...">
                        <button class="ai-assistant-send">
                            <div class="ai-assistant-send-icon"></div>
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Aggiunge l'HTML al body
        document.body.insertAdjacentHTML('beforeend', assistantHTML);
        console.log("AI Assistant: UI HTML injected."); // LOG

        // Ottiene i riferimenti agli elementi dopo averli aggiunti
        chatbox = document.querySelector('.ai-assistant-chatbox');
        assistantButton = document.querySelector('.ai-assistant-button');
        closeButton = document.querySelector('.ai-assistant-close');
        messagesContainer = document.querySelector('.ai-assistant-messages');
        inputField = document.querySelector('.ai-assistant-input');
        sendButton = document.querySelector('.ai-assistant-send');
        suggestionsContainer = document.querySelector('.ai-assistant-suggestions');

        // Verifica che tutti gli elementi siano stati creati
        if (!chatbox || !assistantButton || !closeButton || !messagesContainer || !inputField || !sendButton) {
            console.error("AI Assistant: Critical UI elements not found after injection.");
            return; 
        }
        console.log("AI Assistant: UI elements successfully referenced.");

        // Aggiunge gli event listener
        assistantButton.addEventListener('click', toggleChatbox);
        closeButton.addEventListener('click', toggleChatbox);
        sendButton.addEventListener('click', sendMessage);
        
        inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        // Event listener per i suggerimenti clickabili
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('ai-assistant-suggestion')) {
                    const suggestionText = e.target.textContent;
                    inputField.value = suggestionText;
                    sendMessage();
                }
            });
        }

        // Inizializza l'assistente (autenticazione, messaggi, ecc.)
        initializeAssistantWithFirebase();
    }

    // Funzione per mostrare/nascondere la chatbox
    function toggleChatbox() {
        console.log("AI Assistant: toggleChatbox called."); // LOG
        if (!chatbox || !assistantButton) {
            console.error("AI Assistant: Chatbox or AssistantButton not initialized. Cannot toggle.");
            return;
        }
        
        const isActive = chatbox.classList.contains('active');
        
        if (isActive) {
            // Chiudi
            chatbox.classList.remove('active');
            assistantButton.classList.remove('active');
            assistantButton.style.display = 'flex';
        } else {
            // Apri
            chatbox.classList.add('active');
            assistantButton.classList.add('active');
            
            // Se apriamo la chat e non ci sono messaggi, mostra il benvenuto
            if (messagesContainer && messagesContainer.children.length === 0) {
                updateChatContext();
            }
        }
        
        console.log(`AI Assistant: Chatbox active: ${!isActive}, Button hidden: ${!isActive}`); // LOG
    }

    // --- Inizio Esecuzione --- 
    // Crea l'interfaccia dell'assistente quando il DOM è pronto
    createAssistantUI(); 

    // Tentativo di inizializzazione ritardato nel caso l'evento non arrivi
    setTimeout(() => {
        if (!firebaseReady) {
            console.warn("Timeout attesa Firebase. L'assistente AI potrebbe funzionare in modalità limitata.");
            // Potresti decidere di inizializzare comunque senza Firebase o mostrare un messaggio
            if (window.firebaseWrapper && !window.firebaseWrapper.isInitialized) {
                 try {
                    window.firebaseWrapper.initializeFirebase(); // Forza inizializzazione
                    if (window.firebaseWrapper.isInitialized) {
                        firebaseReady = true;
                        initializeAssistantWithFirebase();
                    }
                 } catch (e) {
                    console.error("Errore forzando inizializzazione Firebase:", e);
                 }
            }
        }
    }, 5000); // Attendi 5 secondi
});

// Funzione separata per inizializzare le funzionalità dipendenti da Firebase
function initializeAssistantWithFirebase() {
    if (!firebaseReady) {
        console.warn("AI Assistant: Firebase not ready, skipping Firebase-dependent initialization."); // LOG
        return;
    }

    console.log("Firebase pronto. Inizializzazione completa dell'assistente AI.");
    db = window.firebaseWrapper.getDatabase();
    auth = window.firebaseWrapper.getAuth();

    // Controllo stato autenticazione e ruolo admin
    window.firebaseWrapper.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            console.log("Utente autenticato:", user.email);
            await checkUserRole(user.uid); // Controlla il ruolo dal DB
            console.log("Ruolo Admin:", isAdmin);
        } else {
            console.log("Nessun utente autenticato.");
            currentUser = null;
            isAdmin = false;
        }
        // Aggiorna suggerimenti e messaggio di benvenuto se la chat è aperta
        updateChatContext();
    });

    // Carica i dati iniziali
    loadDatabaseData();
}

// Funzione per verificare il ruolo dell'utente dal database
async function checkUserRole(uid) {
    if (!firebaseReady || !db) {
        isAdmin = false;
        return;
    }
    try {
        const userRef = window.firebaseWrapper.ref(`users/${uid}/role`);
        const snapshot = await window.firebaseWrapper.get(userRef); // Usa get() per leggere una volta
        if (snapshot.exists() && snapshot.val() === 'admin') {
            isAdmin = true;
        } else {
            isAdmin = false;
        }
    } catch (error) {
        console.error("Errore nel controllo del ruolo admin:", error);
        isAdmin = false;
    }
}

// Funzione per caricare dati dal database
function loadDatabaseData() {
    if (!firebaseReady || !db) return;

    // Carica le disponibilità (organizzate per data)
    const dispRef = window.firebaseWrapper.ref('disponibilita');
    window.firebaseWrapper.onValue(dispRef, (snapshot) => {
        disponibilitaData = snapshot.val() || {}; // Salva l'intero oggetto delle disponibilità
        console.log("Dati disponibilità caricati/aggiornati.");
        // Potresti voler aggiornare la chat se è aperta e si stava parlando di disponibilità
    }, (error) => {
        console.error("Errore caricamento disponibilità:", error);
        // Gestisci l'errore, magari mostrando un messaggio all'utente
    });

    // Carica le prenotazioni
    const prenotazioniRef = window.firebaseWrapper.ref('prenotazioni');
    window.firebaseWrapper.onValue(prenotazioniRef, (snapshot) => {
        prenotazioniData = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const item = childSnapshot.val();
                item.id = childSnapshot.key; // Aggiungi l'ID della prenotazione
                prenotazioniData.push(item);
            });
        }
        console.log("Dati prenotazioni caricati/aggiornati:", prenotazioniData.length);
        // Potresti voler aggiornare la chat se è aperta e si stava parlando di prenotazioni
    }, (error) => {
        console.error("Errore caricamento prenotazioni:", error);
        // Gestisci l'errore
    });
}

// Aggiorna il messaggio di benvenuto e i suggerimenti
function updateChatContext() {
    const chatbox = document.querySelector('.ai-assistant-chatbox');
    const messagesContainer = document.querySelector('.ai-assistant-messages');
    const suggestionsContainer = document.querySelector('.ai-assistant-suggestions');

    if (!chatbox || !chatbox.classList.contains('active')) return;

    if (messagesContainer.childElementCount === 0) {
        showBotMessage(getBotWelcomeMessage());
    }
    showSuggestions(getInitialSuggestions());
}

// Modifica sendMessage per usare solo Gemini AI
function sendMessage() {
    console.log("AI Assistant: sendMessage called.");
    const input = document.querySelector('.ai-assistant-input');
    const suggestionsContainer = document.querySelector('.ai-assistant-suggestions');
    const message = input.value.trim();
    if (!message) return;

    showUserMessage(message);
    input.value = '';
    suggestionsContainer.innerHTML = '';
    showTypingIndicator();

    // Usa sempre Gemini AI per tutte le richieste
    setTimeout(async () => {
        try {
            if (!isGeminiReady) {
                throw new Error("Gemini AI non configurato correttamente");
            }
            
            const response = await callGeminiAIWithSystemAccess(message);
            removeTypingIndicator();
            showBotMessage(response);

            // Suggerimenti intelligenti basati sul contesto
            const contextualSuggestions = generateContextualSuggestions(message, response);
            if (contextualSuggestions.length > 0) {
                showSuggestions(contextualSuggestions);
            }
        } catch (error) {
            removeTypingIndicator();
            console.error("Errore nell'elaborazione del messaggio:", error);
            showBotMessage(`❌ Mi dispiace, si è verificato un errore: ${error.message}\n\nPuoi riprovare o riformulare la tua richiesta.`);
            showSuggestions(["Riprova", "Mostra disponibilità", "Le mie prenotazioni", "Aiuto"]);
        }
    }, 1000 + Math.random() * 1000);
}

// Genera suggerimenti contestuali intelligenti
function generateContextualSuggestions(lastMessage, botResponse) {
    const lowerMessage = lastMessage.toLowerCase();
    const lowerResponse = botResponse.toLowerCase();
    
    let suggestions = [];
    
    if (lowerResponse.includes('disponibilità trovate') || lowerResponse.includes('📅')) {
        suggestions = [
            "Prenota il primo slot disponibile",
            "Mostra solo il weekend",
            "Disponibilità della prossima settimana",
            "Filtra per orario pomeridiano"
        ];
    } else if (lowerResponse.includes('prenotazione confermata') || lowerResponse.includes('🎉')) {
        suggestions = [
            "Mostra dettagli prenotazione",
            "Le mie altre prenotazioni",
            "Come arrivo in sede?",
            "Grazie!"
        ];
    } else if (lowerMessage.includes('prenota') && !lowerResponse.includes('confermata')) {
        suggestions = [
            "Prenota per domani mattina",
            "Prenota per questo weekend",
            "Vedi tutti gli orari disponibili",
            "Preferisco il pomeriggio"
        ];
    } else if (isAdmin) {
        suggestions = [
            "Aggiungi disponibilità per domani",
            "Mostra prenotazioni di oggi",
            "Statistiche del mese",
            "Gestisci slot della settimana"
        ];
    } else {
        suggestions = [
            "Mostra disponibilità",
            "Le mie prenotazioni",
            "Info sui servizi",
            "Come prenoto?"
        ];
    }
    
    return suggestions.slice(0, 4);
}

// Messaggio di benvenuto sempre dinamico
function getBotWelcomeMessage() {
    const ora = new Date().getHours();
    let saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
    
    if (isAdmin) {
        return `${saluto}! Sono Miller AI, il tuo assistente amministrativo intelligente. Posso gestire disponibilità, prenotazioni, statistiche e molto altro. Dimmi cosa devo fare per te!`;
    } else if (currentUser) {
        return `${saluto} ${currentUser.displayName || currentUser.email}! Sono Miller AI. Posso aiutarti a prenotare, gestire i tuoi appuntamenti o rispondere a qualsiasi domanda sui nostri servizi.`;
    } else {
        return `${saluto}! Sono Miller AI, l'assistente intelligente del centro. Posso fornire informazioni, mostrare disponibilità e guidarti nella prenotazione. Come posso aiutarti?`;
    }
}

function getInitialSuggestions() {
    if (isAdmin) {
        return [
            "Mostra le prenotazioni di oggi",
            "Aggiungi disponibilità per domani dalle 9:00 alle 17:00",
            "Statistiche del centro",
            "Gestisci prenotazioni della settimana"
        ];
    } else if (currentUser) {
        return [
            "Mostra le disponibilità di questa settimana",
            "Le mie prenotazioni attive",
            "Prenota per domani pomeriggio",
            "Info sui vostri servizi"
        ];
    } else {
        return [
            "Mostra le disponibilità",
            "Come posso prenotare?",
            "Quali servizi offrite?",
            "Dove siete ubicati?"
        ];
    }
}

// Aggiungi funzione per text-to-speech (lettura vocale dei messaggi)
function speakMessage(text) {
    if ('speechSynthesis' in window) {
        const speech = new SpeechSynthesisUtterance();
        speech.text = text;
        speech.lang = 'it-IT';
        speech.volume = 0.8;
        speech.rate = 1.0;
        speech.pitch = 1.0;
        
        // Trova una voce italiana se disponibile
        const voices = speechSynthesis.getVoices();
        const italianVoice = voices.find(voice => voice.lang.includes('it-IT'));
        if (italianVoice) speech.voice = italianVoice;
        
        window.speechSynthesis.speak(speech);
        return true;
    }
    return false;
}