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
const MIN_API_CALL_INTERVAL = 1000; // Millisecondi

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
        console.log("AI Assistant: Gemini AI configurato e pronto!");
    } else {
        console.error("AI Assistant: Configurazione Gemini mancante! L'assistente non funzionerà.");
        isGeminiReady = false;
    }
}

// Function Declarations for Gemini API
const aiFunctionDeclarations = [
    {
        name: "getAvailableSlots",
        description: "Recupera gli slot di tempo disponibili per una data specifica o tutti gli slot futuri se non viene fornita alcuna data. Restituisce un elenco di slot disponibili, limitato ai primi 10 risultati. Chiedi sempre conferma prima di prenotare uno slot specifico restituito da questa funzione, specialmente se l'utente non ha specificato un ID slot.",
        parameters: {
            type: "object",
            properties: {
                date: {
                    type: "string",
                    description: "La data per verificare la disponibilità nel formato YYYY-MM-DD. Se nullo, restituisce tutti gli slot imminenti."
                }
            }
        }
    },
    {
        name: "addAvailability",
        description: "Aggiunge un nuovo slot di disponibilità al sistema. Richiede privilegi di amministratore. Restituisce un ID univoco per il nuovo slot creato.",
        parameters: {
            type: "object",
            properties: {
                date: { type: "string", description: "La data per cui aggiungere la disponibilità (YYYY-MM-DD)." },
                startTime: { type: "string", description: "L'ora di inizio della disponibilità (HH:MM)." },
                endTime: { type: "string", description: "L'ora di fine della disponibilità (HH:MM)." },
                description: { type: "string", description: "Una descrizione opzionale per lo slot di disponibilità." }
            },
            required: ["date", "startTime", "endTime"]
        }
    },
    {
        name: "removeAvailability",
        description: "Rimuove uno slot di disponibilità esistente dal sistema in una data e ora di inizio specificate. Richiede privilegi di amministratore.",
        parameters: {
            type: "object",
            properties: {
                date: { type: "string", description: "La data da cui rimuovere la disponibilità (YYYY-MM-DD)." },
                startTime: { type: "string", description: "L'ora di inizio dello slot da rimuovere (HH:MM)." }
            },
            required: ["date", "startTime"]
        }
    },
    {
        name: "createBooking",
        description: "Crea una nuova prenotazione per uno slot di disponibilità. L'utente deve essere autenticato. Verifica se lo slot è ancora disponibile prima di tentare la prenotazione. Restituisce i dettagli della prenotazione creata.",
        parameters: {
            type: "object",
            properties: {
                slotId: { type: "string", description: "L'ID univoco dello slot di disponibilità da prenotare." },
                date: { type: "string", description: "La data della prenotazione (YYYY-MM-DD)." },
                startTime: { type: "string", description: "L'ora di inizio della prenotazione (HH:MM)." },
                endTime: { type: "string", description: "L'ora di fine della prenotazione (HH:MM)." },
                customerName: { type: "string", description: "Il nome del cliente per la prenotazione." },
                customerEmail: { type: "string", description: "L'email del cliente per la prenotazione." },
                customerPhone: { type: "string", description: "Il numero di telefono del cliente (opzionale)." },
                notes: { type: "string", description: "Eventuali note aggiuntive per la prenotazione (opzionale)." }
            },
            required: ["slotId", "date", "startTime", "endTime", "customerName", "customerEmail"]
        }
    },
    {
        name: "getUserBookings",
        description: "Recupera un elenco di prenotazioni per l'utente attualmente autenticato o per un ID utente specificato (se l'utente corrente è un amministratore).",
        parameters: {
            type: "object",
            properties: {
                userId: { type: "string", description: "L'ID dell'utente per cui recuperare le prenotazioni (opzionale, utilizzabile solo dagli amministratori)." }
            }
        }
    },
    {
        name: "getAllBookings",
        description: "Recupera tutte le prenotazioni nel sistema. Può essere filtrato per data. Richiede privilegi di amministratore.",
        parameters: {
            type: "object",
            properties: {
                date: { type: "string", description: "La data per cui filtrare le prenotazioni (YYYY-MM-DD, opzionale)." }
            }
        }
    },
    {
        name: "cancelBooking",
        description: "Annulla una prenotazione esistente. Gli utenti possono cancellare le proprie prenotazioni; gli amministratori possono cancellare qualsiasi prenotazione.",
        parameters: {
            type: "object",
            properties: {
                bookingId: { type: "string", description: "L'ID univoco della prenotazione da annullare." }
            },
            required: ["bookingId"]
        }
    },
    {
        name: "getCurrentUser",
        description: "Recupera le informazioni sull'utente attualmente autenticato, incluso se è un amministratore.",
        parameters: { type: "object", properties: {} }
    },
    {
        name: "getSystemStats",
        description: "Recupera le statistiche di sistema come il numero totale di prenotazioni, le prenotazioni di oggi e il numero di slot disponibili. Richiede privilegi di amministratore.",
        parameters: { type: "object", properties: {} }
    }
];

// Sistema di funzioni disponibili per l'AI
const availableFunctions = {
    getAvailableSlots: async ({ date = null } = {}) => {
        console.log(`AI Assistant: getAvailableSlots called. Date: ${date}`);
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }
        if (!disponibilitaData) {
            console.warn("AI Assistant: getAvailableSlots - disponibilitaData non ancora caricato.");
            return { message: "Dati sulle disponibilità non ancora caricati. Riprova tra un momento." };
        }
        
        const slots = [];
        const datesToScan = date ? [date] : Object.keys(disponibilitaData).sort();
        
        for (const dateKey of datesToScan) {
            const daySlots = disponibilitaData[dateKey];
            if (daySlots) {
                for (const slotId in daySlots) {
                    const slot = daySlots[slotId];
                    if (slot.isActive && !slot.isBooked) {
                        const [hours, minutes] = slot.startTime.split(':');
                        const slotDateTime = new Date(dateKey);
                        slotDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                        
                        if (slotDateTime > new Date()) { // Considera solo slot futuri
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
        if (slots.length === 0) {
            return { message: date ? `Nessuno slot disponibile trovato per il ${date}.` : "Nessuno slot disponibile trovato." };
        }
        return slots.slice(0, 10); // Limita a 10 risultati
    },

    addAvailability: async ({ date, startTime, endTime, description = '' }) => {
        console.log(`AI Assistant: addAvailability called. Date: ${date}, Start: ${startTime}, End: ${endTime}, Desc: ${description}`);
        if (!isAdmin) throw new Error("Operazione non autorizzata. Solo gli amministratori possono aggiungere disponibilità.");
        if (!date || !startTime || !endTime) throw new Error("Data, ora di inizio e ora di fine sono obbligatorie.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }

        const path = `disponibilita/${date}`;
        console.log(`AI Assistant: addAvailability - Path Firebase: ${path}`);
        try {
            const dateRef = window.firebaseWrapper.ref(path);
            const newSlotRef = await window.firebaseWrapper.push(dateRef, {
                startTime,
                endTime,
                description,
                isActive: true,
                isBooked: false
            });
            console.log(`AI Assistant: addAvailability - Slot aggiunto con ID: ${newSlotRef.key} a ${path}`);
            return { success: true, id: newSlotRef.key, message: `Disponibilità aggiunta per ${date} dalle ${startTime} alle ${endTime}.` };
        } catch (error) {
            console.error(`AI Assistant: addAvailability - Errore Firebase nell'aggiunta a ${path}:`, error);
            throw new Error(`Errore Firebase nell'aggiunta della disponibilità: ${error.message}`);
        }
    },

    removeAvailability: async ({ date, startTime }) => {
        console.log(`AI Assistant: removeAvailability called. Date: ${date}, Start: ${startTime}`);
        if (!isAdmin) throw new Error("Operazione non autorizzata. Solo gli amministratori possono rimuovere disponibilità.");
        if (!date || !startTime) throw new Error("Data e ora di inizio sono obbligatorie.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }

        const slotsOnDate = disponibilitaData[date];
        if (!slotsOnDate) throw new Error(`Nessuna disponibilità trovata per la data ${date}.`);
        
        let slotIdToRemove = null;
        for (const id in slotsOnDate) {
            if (slotsOnDate[id].startTime === startTime) {
                slotIdToRemove = id;
                break;
            }
        }
        
        if (!slotIdToRemove) throw new Error(`Slot non trovato per la data ${date} alle ${startTime}.`);
        
        const path = `disponibilita/${date}/${slotIdToRemove}`;
        console.log(`AI Assistant: removeAvailability - Path Firebase: ${path}`);
        try {
            await window.firebaseWrapper.remove(window.firebaseWrapper.ref(path));
            console.log(`AI Assistant: removeAvailability - Slot rimosso: ${path}`);
            return { success: true, message: `Disponibilità ${date} ${startTime} rimossa.` };
        } catch (error) {
            console.error(`AI Assistant: removeAvailability - Errore Firebase nella rimozione da ${path}:`, error);
            throw new Error(`Errore Firebase nella rimozione: ${error.message}`);
        }
    },

    createBooking: async ({ slotId, date, startTime, endTime, customerName, customerEmail, customerPhone = '', notes = '' }) => {
        console.log(`AI Assistant: createBooking called. SlotID: ${slotId}, Date: ${date}, Name: ${customerName}`);
        if (!currentUser) throw new Error("Devi essere autenticato per prenotare. Effettua il login o registrati.");
        if (!slotId || !date || !startTime || !endTime || !customerName || !customerEmail) {
            throw new Error("Parametri mancanti. Sono richiesti slotId, date, startTime, endTime, customerName, customerEmail.");
        }
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }

        const slotDataPath = `disponibilita/${date}/${slotId}`;
        const slotSnapshot = await window.firebaseWrapper.get(window.firebaseWrapper.ref(slotDataPath));
        if (!slotSnapshot.exists() || slotSnapshot.val().isBooked) {
             console.warn(`AI Assistant: createBooking - Slot ${slotId} su ${date} non disponibile o già prenotato.`);
            throw new Error(`Lo slot ${slotId} per la data ${date} non è più disponibile o non esiste.`);
        }
        
        console.log(`AI Assistant: createBooking - Path prenotazioni: prenotazioni, Path slot: ${slotDataPath}`);
        try {
            const bookingData = {
                name: customerName, email: customerEmail, phone: customerPhone, notes: notes,
                userId: currentUser.uid, userEmail: currentUser.email,
                timestamp: new Date().toISOString(), slotId, date, startTime, endTime, status: 'confirmed'
            };

            const newBookingRef = await window.firebaseWrapper.push(window.firebaseWrapper.ref('prenotazioni'), bookingData);
            bookingData.id = newBookingRef.key; // Aggiungi l'ID generato alla risposta
            
            await window.firebaseWrapper.update(window.firebaseWrapper.ref(slotDataPath), { isBooked: true, bookingId: newBookingRef.key });
            console.log(`AI Assistant: createBooking - Prenotazione creata ID: ${newBookingRef.key}, Slot ${slotId} aggiornato.`);
            return { success: true, bookingId: newBookingRef.key, bookingData };
        } catch (error) {
            console.error(`AI Assistant: createBooking - Errore Firebase:`, error);
            throw new Error(`Errore Firebase nella creazione della prenotazione: ${error.message}`);
        }
    },

    getUserBookings: async ({ userId = null } = {}) => {
        const targetUserId = userId || (currentUser ? currentUser.uid : null);
        console.log(`AI Assistant: getUserBookings called. TargetUserID: ${targetUserId}`);
        if (!targetUserId) throw new Error("Utente non identificato. Impossibile recuperare le prenotazioni.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }
        if (!prenotazioniData) {
             console.warn("AI Assistant: getUserBookings - prenotazioniData non ancora caricato.");
            return { message: "Dati sulle prenotazioni non ancora caricati. Riprova tra un momento." };
        }
        
        const userBookings = prenotazioniData.filter(booking => booking.userId === targetUserId);
        if (userBookings.length === 0) return { message: "Nessuna prenotazione trovata per questo utente." };
        return userBookings;
    },

    getAllBookings: async ({ date = null } = {}) => {
        console.log(`AI Assistant: getAllBookings called. Date: ${date}`);
        if (!isAdmin) throw new Error("Operazione non autorizzata. Solo gli amministratori possono visualizzare tutte le prenotazioni.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }
        if (!prenotazioniData) {
            console.warn("AI Assistant: getAllBookings - prenotazioniData non ancora caricato.");
            return { message: "Dati sulle prenotazioni non ancora caricati. Riprova tra un momento." };
        }
        
        let bookingsToReturn = prenotazioniData;
        if (date) {
            bookingsToReturn = prenotazioniData.filter(booking => booking.date === date);
        }
        if (bookingsToReturn.length === 0) return { message: date ? `Nessuna prenotazione trovata per la data ${date}.` : "Nessuna prenotazione trovata nel sistema." };
        return bookingsToReturn;
    },

    cancelBooking: async ({ bookingId }) => {
        console.log(`AI Assistant: cancelBooking called. BookingID: ${bookingId}`);
        if (!bookingId) throw new Error("ID prenotazione mancante.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }

        const booking = prenotazioniData.find(b => b.id === bookingId);
        if (!booking) throw new Error(`Prenotazione con ID ${bookingId} non trovata.`);
        
        if (!isAdmin && (!currentUser || booking.userId !== currentUser.uid)) {
            throw new Error("Non autorizzato a cancellare questa prenotazione.");
        }
        
        const bookingPath = `prenotazioni/${bookingId}`;
        const slotPath = `disponibilita/${booking.date}/${booking.slotId}`;
        console.log(`AI Assistant: cancelBooking - Path prenotazione: ${bookingPath}, Path slot: ${slotPath}`);
        try {
            await window.firebaseWrapper.remove(window.firebaseWrapper.ref(bookingPath));
            await window.firebaseWrapper.update(window.firebaseWrapper.ref(slotPath), { isBooked: false, bookingId: null });
            console.log(`AI Assistant: cancelBooking - Prenotazione ${bookingId} rimossa, slot ${booking.slotId} liberato.`);
            return { success: true, message: `Prenotazione ${bookingId} cancellata con successo.` };
        } catch (error) {
            console.error(`AI Assistant: cancelBooking - Errore Firebase:`, error);
            throw new Error(`Errore Firebase nella cancellazione: ${error.message}`);
        }
    },

    getCurrentUser: () => {
        console.log("AI Assistant: getCurrentUser called.");
        return currentUser ? {
            uid: currentUser.uid, email: currentUser.email,
            displayName: currentUser.displayName, isAdmin: isAdmin
        } : null;
    },

    getSystemStats: async () => {
        console.log("AI Assistant: getSystemStats called.");
        if (!isAdmin) throw new Error("Operazione non autorizzata. Solo gli amministratori possono visualizzare le statistiche.");
        if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
            throw new Error("Servizio Firebase non pronto. Riprova tra poco.");
        }
        
        const today = new Date().toISOString().split('T')[0];
        const totalBookings = prenotazioniData.length;
        const todaysBookings = prenotazioniData.filter(b => b.date === today).length;
        
        // Chiamata interna sicura, non diretta all'API
        const availableSlotsResult = await this.getAvailableSlots(); 
        const availableSlotsCount = Array.isArray(availableSlotsResult) ? availableSlotsResult.length : 0;

        return {
            totalBookings, todaysBookings, availableSlotsCount, isAdmin,
            message: `Statistiche: ${totalBookings} prenotazioni totali, ${todaysBookings} oggi, ${availableSlotsCount} slot disponibili.`
        };
    }
};

// Funzione principale per chiamare Gemini AI con accesso alle funzioni del sistema
async function callGeminiAIWithSystemAccess(prompt, history = []) {
    if (!isGeminiReady) {
        console.error("AI Assistant: callGeminiAIWithSystemAccess - Gemini AI non configurato.");
        throw new Error("Gemini AI non configurato");
    }
     if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
        console.warn("AI Assistant: callGeminiAIWithSystemAccess - Firebase non pronto. L'AI potrebbe non avere dati aggiornati.");
        // Non lanciare errore qui, l'AI potrebbe comunque rispondere a domande generiche
    }


    const now = Date.now();
    if (now - lastApiCallTime < MIN_API_CALL_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, MIN_API_CALL_INTERVAL - (now - lastApiCallTime)));
    }
    lastApiCallTime = Date.now();

    const currentPage = window.location.pathname.split("/").pop() || "home";
    const systemContext = await prepareSystemContext(); 

    const systemPrompt = `Sei Miller AI, l'assistente virtuale avanzato di un centro estetico/benessere.
Il tuo obiettivo è assistere gli utenti fornendo informazioni, gestendo disponibilità e prenotazioni utilizzando gli strumenti a tua disposizione.
Rispondi sempre in italiano. Sii cortese e professionale.
Quando usi uno strumento e ottieni un risultato, presenta quel risultato all'utente in modo chiaro e naturale. Non limitarti a restituire i dati JSON.
Se un'operazione fallisce o un utente non è autorizzato, spiegalo gentilmente.
Contesto attuale:
- Utente: ${systemContext.currentUser ? `${systemContext.currentUser.email} (${systemContext.currentUser.isAdmin ? 'Admin' : 'Cliente'})` : 'Non autenticato'}
- Pagina: ${currentPage}
- Data e ora correnti: ${new Date().toLocaleString('it-IT')}
Non chiedere informazioni già disponibili nel contesto, come l'email dell'utente se è autenticato.
Prima di eseguire un'azione che modifica i dati (es. createBooking, addAvailability, cancelBooking), se l'utente non ha fornito tutti i dettagli necessari nella sua richiesta iniziale, chiedi conferma o ulteriori dettagli.
Se l'utente chiede di "vedere" o "mostrare" qualcosa, usa la funzione appropriata e poi descrivi i risultati.
Se l'utente fa una domanda generica, rispondi direttamente senza usare funzioni se non necessario.
Se una funzione restituisce un messaggio di errore o un esito negativo, comunicalo all'utente in modo chiaro.
Se l'utente chiede di fare qualcosa per cui non ha i permessi (es. un non-admin che cerca di aggiungere disponibilità), informalo che non ha i permessi necessari.`;

    const tools = [{ function_declarations: aiFunctionDeclarations }];
    let requestContents = [];

    history.forEach(h => {
        if (h.role === 'user' || h.role === 'model') {
             requestContents.push({ role: h.role, parts: h.parts });
        }
    });
    requestContents.push({ role: "user", parts: [{ text: prompt }] });
    
    console.log("AI Assistant: Invio richiesta a Gemini API. Prompt:", prompt);
    // console.log("AI Assistant: Request Contents to Gemini:", JSON.stringify(requestContents, null, 2));

    try {
        const response = await fetch(`${geminiAPI.endpoint}?key=${geminiAPI.apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: requestContents,
                tools: tools,
                system_instruction: { parts: [{ text: systemPrompt }] },
                generation_config: {
                    temperature: geminiAPI.temperature,
                    max_output_tokens: geminiAPI.maxOutputTokens,
                    top_p: 0.9,
                },
                safety_settings: [
                    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
                    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" }
                ]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI Assistant: Errore API Gemini:", response.status, errorBody);
            let friendly = `Errore API Gemini: ${response.status}`;
            if (errorBody && errorBody.includes('API key not valid')) {
                friendly = 'Chiave API Gemini non valida o mancante. Verifica la configurazione.';
            } else if (errorBody) {
                friendly += ` - ${errorBody}`;
            }
            throw new Error(friendly);
        }

        const data = await response.json();
        // console.log("AI Assistant: Risposta da Gemini:", JSON.stringify(data, null, 2));

        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            console.error("AI Assistant: Risposta API Gemini non valida o vuota:", data);
            throw new Error("Risposta API Gemini non valida o vuota.");
        }
        
        const responsePart = data.candidates[0].content.parts[0];

        if (responsePart.functionCall) {
            const functionCall = responsePart.functionCall;
            const functionName = functionCall.name;
            const functionArgs = functionCall.args || {};

            console.log(`AI Assistant: Richiesta function call: ${functionName} con argomenti:`, functionArgs);

            if (availableFunctions[functionName]) {
                try {
                    const functionResult = await availableFunctions[functionName](functionArgs);
                    console.log(`AI Assistant: Funzione ${functionName} eseguita. Risultato:`, functionResult);

                    let newHistory = [...requestContents]; 
                    newHistory.push({ role: "model", parts: [responsePart] }); 
                    newHistory.push({
                        role: "user", 
                        parts: [{
                            functionResponse: {
                                name: functionName,
                                response: { 
                                    content: functionResult !== undefined && functionResult !== null ? functionResult : { message: "Operazione completata senza output specifico." },
                                }
                            }
                        }]
                    });
                    return await callGeminiAIWithSystemAccess("", newHistory); 
                } catch (error) {
                    console.error(`AI Assistant: Errore durante l'esecuzione della funzione ${functionName}:`, error);
                    let newHistory = [...requestContents];
                    newHistory.push({ role: "model", parts: [responsePart] });
                    newHistory.push({
                        role: "user",
                        parts: [{
                            functionResponse: {
                                name: functionName,
                                response: { error: `Errore nell'eseguire ${functionName}: ${error.message}` }
                            }
                        }]
                    });
                    return await callGeminiAIWithSystemAccess("", newHistory);
                }
            } else {
                console.error(`AI Assistant: Funzione ${functionName} richiesta dall'AI ma non trovata.`);
                let newHistory = [...requestContents];
                newHistory.push({ role: "model", parts: [responsePart] });
                newHistory.push({
                    role: "user",
                    parts: [{
                        functionResponse: {
                            name: functionName,
                            response: { error: `La funzione ${functionName} non esiste.` }
                        }
                    }]
                });
                return await callGeminiAIWithSystemAccess("", newHistory);
            }
        } else if (responsePart.text) {
            console.log("AI Assistant: Ricevuta risposta testuale da Gemini:", responsePart.text);
            return responsePart.text;
        } else {
            console.error("AI Assistant: Parte di risposta API Gemini non contiene né testo né functionCall:", responsePart);
            throw new Error("Risposta API Gemini in formato imprevisto.");
        }

    } catch (error) {
        console.error("AI Assistant: Errore chiamata Gemini API o elaborazione:", error);
        return `Mi dispiace, si è verificato un errore tecnico (${error.message}). Riprova più tardi.`;
    }
}

// Prepara il contesto completo del sistema per l'AI
async function prepareSystemContext() {
    const context = {
        currentUser: availableFunctions.getCurrentUser(), // Sincrono
        availableSlotsCount: 0, 
        totalBookings: prenotazioniData.length,
        todaysBookings: 0, 
    };
    
    try {
        // Chiamata asincrona per ottenere gli slot disponibili, usando la funzione interna
        const availableSlotsResult = await availableFunctions.getAvailableSlots({}); // Passa oggetto vuoto per default
        context.availableSlotsCount = Array.isArray(availableSlotsResult) ? availableSlotsResult.length : 0;
        
        const today = new Date().toISOString().split('T')[0];
        context.todaysBookings = prenotazioniData.filter(b => b.date === today).length;
    } catch (error) {
        console.error("AI Assistant: Errore nel preparare il contesto dinamico (availableSlots):", error);
    }
    return context;
}

// (Le funzioni UI e di gestione dei messaggi come sendMessage, showUserMessage, showBotMessage, ecc. rimangono)
// Modifica sendMessage per usare solo Gemini AI
function sendMessage() {
    console.log("AI Assistant: sendMessage called.");
    const input = document.querySelector('.ai-assistant-input');
    const suggestionsContainer = document.querySelector('.ai-assistant-suggestions');
    const message = input.value.trim();
    if (!message) return;

    showUserMessage(message);
    input.value = '';
    if (suggestionsContainer) suggestionsContainer.innerHTML = '';
    showTypingIndicator();
    
    (async () => {
        try {
            if (!isGeminiReady) {
                console.error("AI Assistant: sendMessage - Gemini AI non pronto.");
                throw new Error("Gemini AI non configurato correttamente");
            }
            
            const response = await callGeminiAIWithSystemAccess(message, []); 
            removeTypingIndicator();
            showBotMessage(response); 

            // const contextualSuggestions = generateContextualSuggestions(message, response);
            // if (contextualSuggestions.length > 0) {
            //     showSuggestions(contextualSuggestions);
            // }
        } catch (error) {
            removeTypingIndicator();
            console.error("AI Assistant: sendMessage - Errore nell'elaborazione del messaggio con Gemini:", error);
            showBotMessage(`❌ Mi dispiace, si è verificato un errore: ${error.message}\n\nPuoi riprovare o riformulare la tua richiesta.`);
            // showSuggestions(["Riprova", "Mostra disponibilità", "Le mie prenotazioni", "Aiuto"]);
        }
    })();
}

// QUESTA FUNZIONE POTREBBE AVER BISOGNO DI REVISIONE O ESSERE RIMOSSA/SEMPLIFICATA
function generateContextualSuggestions(lastMessage, botResponse) {
    // ... (implementazione invariata per ora)
    const lowerMessage = lastMessage.toLowerCase();
    const lowerResponse = botResponse ? botResponse.toLowerCase() : "";
    
    let suggestions = [];
    
    if (lowerResponse.includes('disponibilità trovate') || lowerResponse.includes('📅')) {
        suggestions = [ "Prenota il primo slot disponibile", "Mostra solo il weekend", "Disponibilità della prossima settimana", "Filtra per orario pomeridiano" ];
    } else if (lowerResponse.includes('prenotazione confermata') || lowerResponse.includes('🎉')) {
        suggestions = [ "Mostra dettagli prenotazione", "Le mie altre prenotazioni", "Come arrivo in sede?", "Grazie!" ];
    } else if (lowerMessage.includes('prenota') && !lowerResponse.includes('confermata')) {
        suggestions = [ "Prenota per domani mattina", "Prenota per questo weekend", "Vedi tutti gli orari disponibili", "Preferisco il pomeriggio" ];
    } else if (isAdmin) {
        suggestions = [ "Aggiungi disponibilità per domani", "Mostra prenotazioni di oggi", "Statistiche del mese", "Gestisci slot della settimana" ];
    } else {
        suggestions = [ "Mostra disponibilità", "Le mie prenotazioni", "Info sui servizi", "Come prenoto?" ];
    }
    
    suggestions = suggestions.filter(sugg => !lowerMessage.includes(sugg.toLowerCase()) && !lowerResponse.includes(sugg.toLowerCase()));
    return suggestions.slice(0, 4);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("AI Assistant: DOMContentLoaded event fired."); 
    initializeGeminiAPI();
    
    let chatbox, assistantButton, closeButton, messagesContainer, inputField, sendButton, suggestionsContainer, overlay;
    let confirmationCallback = null; // Non più usato con function calling?
    let typingIndicator;

    function createAssistantUI() {
        console.log("AI Assistant: Attempting to create UI..."); 
        const existingContainer = document.querySelector('.ai-assistant-container');
        if (existingContainer) existingContainer.remove();
        
        const assistantHTML = `
            <div class="ai-assistant-overlay"></div>
            <div class="ai-assistant-container"> <div class="ai-assistant-button">🤖</div>
                <div class="ai-assistant-chatbox">
                    <div class="ai-assistant-header">
                        <div class="ai-assistant-header-title"><div class="ai-assistant-header-logo">🤖</div><span>Miller AI</span></div>
                        <button class="ai-assistant-close">&times;</button>
                    </div>
                    <div class="ai-assistant-messages"></div> <div class="ai-assistant-suggestions"></div>
                    <div class="ai-assistant-input-container">
                        <input type="text" class="ai-assistant-input" placeholder="Scrivi un messaggio...">
                        <button class="ai-assistant-send"><div class="ai-assistant-send-icon"></div></button>
                    </div>
                </div> </div>`;
        document.body.insertAdjacentHTML('beforeend', assistantHTML);
        console.log("AI Assistant: UI HTML injected."); 

        overlay = document.querySelector('.ai-assistant-overlay');
        chatbox = document.querySelector('.ai-assistant-chatbox');
        assistantButton = document.querySelector('.ai-assistant-button');
        closeButton = document.querySelector('.ai-assistant-close');
        messagesContainer = document.querySelector('.ai-assistant-messages');
        inputField = document.querySelector('.ai-assistant-input');
        sendButton = document.querySelector('.ai-assistant-send');
        suggestionsContainer = document.querySelector('.ai-assistant-suggestions');
        typingIndicator = document.createElement('div'); // Creato ma non aggiunto/usato attivamente qui
        typingIndicator.className = 'ai-assistant-typing-indicator';
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';


        if (!chatbox || !assistantButton || !closeButton || !messagesContainer || !inputField || !sendButton) {
            console.error("AI Assistant: Critical UI elements not found after injection.");
            return; 
        }
        console.log("AI Assistant: UI elements successfully referenced.");

        assistantButton.addEventListener('click', toggleChatbox);
        closeButton.addEventListener('click', toggleChatbox);
        if (overlay) overlay.addEventListener('click', toggleChatbox);
        sendButton.addEventListener('click', sendMessage);
        inputField.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        if (suggestionsContainer) {
            suggestionsContainer.addEventListener('click', (e) => {
                if (e.target.classList.contains('ai-assistant-suggestion')) {
                    inputField.value = e.target.textContent; sendMessage();
                }
            });
        }

        if (window.firebaseWrapper && window.firebaseWrapper.isInitialized) {
            console.log("AI Assistant: Firebase già pronto durante createUI.");
            firebaseReady = true;
            initializeAssistantWithFirebase();
        } else {
            console.log("AI Assistant: Firebase non pronto durante createUI, in ascolto di firebase-ready.");
            document.addEventListener('firebase-ready', () => {
                console.log("AI Assistant: firebase-ready event ricevuto in createUI.");
                firebaseReady = true;
                initializeAssistantWithFirebase();
            }, { once: true });
        }
    }

    function toggleChatbox() {
        console.log("AI Assistant: toggleChatbox called."); 
        if (!chatbox || !assistantButton) {
            console.error("AI Assistant: Chatbox or AssistantButton not initialized. Cannot toggle."); return;
        }
        const isActive = chatbox.classList.toggle('active');
        assistantButton.classList.toggle('active', isActive);
        if (overlay) overlay.classList.toggle('active', isActive);
        assistantButton.style.display = isActive ? 'none' : 'flex'; // Nasconde il pulsante quando la chat è attiva
        if (isActive && messagesContainer && messagesContainer.children.length === 0) {
            updateChatContext();
        }
        console.log(`AI Assistant: Chatbox active: ${isActive}`);
    }
    createAssistantUI(); 
});

function initializeAssistantWithFirebase() {
    if (!firebaseReady || !window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
        console.warn("AI Assistant: initializeAssistantWithFirebase - Firebase non pronto o wrapper non inizializzato."); 
        if (window.firebaseWrapper && !window.firebaseWrapper.isInitialized) {
            console.log("AI Assistant: initializeAssistantWithFirebase - Tentativo di inizializzazione Firebase via wrapper.");
            window.firebaseWrapper.initializeFirebase(); 
        }
        if (!window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
             console.log("AI Assistant: initializeAssistantWithFirebase - Ancora non pronto, attendo evento firebase-ready.");
             if (!document.querySelector('.ai-assistant-container')) { 
                document.addEventListener('firebase-ready', () => {
                    console.log("AI Assistant: firebase-ready event (deferred check).");
                    firebaseReady = true; initializeAssistantWithFirebase();
                }, { once: true }); 
             }
             return;
        }
        firebaseReady = true; 
    }

    console.log("AI Assistant: Firebase pronto. Inizializzazione completa dell'assistente AI.");
    db = window.firebaseWrapper.getDatabase(); 
    if (!window.firebaseWrapper.auth) {
        console.error("AI Assistant: Firebase Auth object non disponibile su firebaseWrapper."); return;
    }
    auth = window.firebaseWrapper.auth;

    auth.onAuthStateChanged(async (user) => {
        currentUser = user;
        if (user) {
            console.log("AI Assistant: Utente autenticato:", user.email);
            await checkUserRole(user.uid); 
            console.log("AI Assistant: Ruolo Admin:", isAdmin);
        } else {
            console.log("AI Assistant: Nessun utente autenticato.");
            currentUser = null; isAdmin = false;
        }
        updateChatContext();
    });
    loadDatabaseData();
}

async function checkUserRole(uid) {
    console.log(`AI Assistant: checkUserRole per UID: ${uid}`);
    if (!firebaseReady || !db || !window.firebaseWrapper.isInitialized) {
        console.warn("AI Assistant: checkUserRole - Firebase non pronto.");
        isAdmin = false; return;
    }
    const userRolePath = `users/${uid}/role`;
    try {
        const snapshot = await window.firebaseWrapper.get(window.firebaseWrapper.ref(userRolePath)); 
        if (snapshot.exists() && snapshot.val() === 'admin') {
            console.log("AI Assistant: checkUserRole - Utente è admin.");
            isAdmin = true;
        } else {
            console.log("AI Assistant: checkUserRole - Utente non è admin o ruolo non specificato.");
            isAdmin = false;
        }
    } catch (error) {
        console.error(`AI Assistant: checkUserRole - Errore nel controllo del ruolo admin da ${userRolePath}:`, error);
        isAdmin = false;
    }
}

function loadDatabaseData() {
    console.log("AI Assistant: loadDatabaseData chiamato.");
    if (!firebaseReady || !db || !window.firebaseWrapper.isInitialized) {
        console.warn("AI Assistant: loadDatabaseData - Firebase non pronto. Caricamento dati saltato.");
        return;
    }

    const dispPath = 'disponibilita';
    console.log(`AI Assistant: Inizio ascolto su ${dispPath}`);
    window.firebaseWrapper.onValue(window.firebaseWrapper.ref(dispPath), (snapshot) => {
        disponibilitaData = snapshot.val() || {}; 
        console.log("AI Assistant: Dati disponibilità caricati/aggiornati. Numero di date:", Object.keys(disponibilitaData).length);
    }, (error) => {
        console.error(`AI Assistant: Errore Firebase caricamento disponibilità da ${dispPath}:`, error);
    });

    const prenotazioniPath = 'prenotazioni';
    console.log(`AI Assistant: Inizio ascolto su ${prenotazioniPath}`);
    window.firebaseWrapper.onValue(window.firebaseWrapper.ref(prenotazioniPath), (snapshot) => {
        prenotazioniData = [];
        if (snapshot.exists()) {
            snapshot.forEach((childSnapshot) => {
                const item = childSnapshot.val();
                item.id = childSnapshot.key; 
                prenotazioniData.push(item);
            });
        }
        console.log("AI Assistant: Dati prenotazioni caricati/aggiornati. Numero prenotazioni:", prenotazioniData.length);
    }, (error) => {
        console.error(`AI Assistant: Errore Firebase caricamento prenotazioni da ${prenotazioniPath}:`, error);
    });
}

function updateChatContext() {
    const chatbox = document.querySelector('.ai-assistant-chatbox');
    const messagesContainer = document.querySelector('.ai-assistant-messages');
    // const suggestionsContainer = document.querySelector('.ai-assistant-suggestions'); // Già definito in createAssistantUI

    if (!chatbox || !chatbox.classList.contains('active')) return;
    if (messagesContainer && messagesContainer.childElementCount === 0) { // Solo se non ci sono messaggi
        showBotMessage(getBotWelcomeMessage());
    }
    // showSuggestions(getInitialSuggestions()); // I suggerimenti iniziali potrebbero essere gestiti dall'AI
}

function getBotWelcomeMessage() {
    const ora = new Date().getHours();
    let saluto = ora < 12 ? "Buongiorno" : ora < 18 ? "Buon pomeriggio" : "Buonasera";
    if (isAdmin) return `${saluto}! Sono Miller AI, il tuo assistente amministrativo. Come posso aiutarti oggi?`;
    if (currentUser) return `${saluto} ${currentUser.displayName || currentUser.email}! Sono Miller AI. Come posso assisterti?`;
    return `${saluto}! Sono Miller AI. Chiedimi informazioni o aiuto per prenotare.`;
}

function getInitialSuggestions() { // Questa funzione potrebbe diventare meno rilevante
    if (isAdmin) return ["Mostra prenotazioni di oggi", "Aggiungi disponibilità", "Statistiche"];
    if (currentUser) return ["Le mie prenotazioni", "Mostra disponibilità", "Prenota per domani"];
    return ["Mostra disponibilità", "Come prenoto?", "Info sui servizi"];
}

// Funzioni UI (showUserMessage, showBotMessage, showTypingIndicator, ecc.) da definire qui
// Queste funzioni manipolano .ai-assistant-messages, .ai-assistant-suggestions, ecc.
// Assicurarsi che siano definite globalmente o passate/accessibili dove necessario.

function showUserMessage(message) {
    const messagesContainer = document.querySelector('.ai-assistant-messages');
    if (!messagesContainer) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('ai-assistant-message', 'user');
    messageElement.textContent = message;
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function showBotMessage(message) {
    const messagesContainer = document.querySelector('.ai-assistant-messages');
    if (!messagesContainer) return;
    const messageElement = document.createElement('div');
    messageElement.classList.add('ai-assistant-message', 'bot');
    // Semplice markdown per grassetto e corsivo (da estendere se necessario)
    const formatted = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>');
    const plain = message.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
    messageElement.textContent = '';
    messagesContainer.appendChild(messageElement);
    let index = 0;
    const typeInterval = setInterval(() => {
        messageElement.textContent = plain.slice(0, index);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        index++;
        if (index > plain.length) {
            clearInterval(typeInterval);
            messageElement.innerHTML = formatted;
            // speakMessage(messageElement.textContent); // Rimuovi textContent se vuoi che legga il markdown formattato
        }
    }, 20);
}

function showTypingIndicator() {
    const messagesContainer = document.querySelector('.ai-assistant-messages');
    const typingIndicator = document.querySelector('.ai-assistant-typing-indicator') || document.createElement('div');
    if (!document.querySelector('.ai-assistant-typing-indicator')) {
        typingIndicator.className = 'ai-assistant-typing-indicator ai-assistant-message bot'; // Applica stili messaggio bot
        typingIndicator.innerHTML = '<span></span><span></span><span></span>';
        messagesContainer.appendChild(typingIndicator);
    }
    typingIndicator.style.display = 'flex'; // Assicurati che sia visibile
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.ai-assistant-typing-indicator');
    if (typingIndicator) {
        typingIndicator.style.display = 'none'; // Nascondi invece di rimuovere per riutilizzarlo
    }
}

function showSuggestions(suggestionsArray) {
    const suggestionsContainer = document.querySelector('.ai-assistant-suggestions');
    if (!suggestionsContainer) return;
    suggestionsContainer.innerHTML = ''; // Pulisci vecchi suggerimenti
    if (suggestionsArray && suggestionsArray.length > 0) {
        suggestionsArray.forEach(suggText => {
            const button = document.createElement('button');
            button.className = 'ai-assistant-suggestion';
            button.textContent = suggText;
            suggestionsContainer.appendChild(button);
        });
        suggestionsContainer.style.display = 'flex'; // Mostra il contenitore
    } else {
        suggestionsContainer.style.display = 'none'; // Nascondi se non ci sono suggerimenti
    }
}

function speakMessage(text) {
    if ('speechSynthesis' in window) {
        // Pulisci il testo da Markdown per una lettura più naturale
        const cleanedText = text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        const speech = new SpeechSynthesisUtterance(cleanedText);
        speech.lang = 'it-IT';
        speech.volume = 0.8; speech.rate = 1.0; speech.pitch = 1.0;
        const voices = speechSynthesis.getVoices();
        const italianVoice = voices.find(voice => voice.lang.startsWith('it-IT'));
        if (italianVoice) speech.voice = italianVoice;
        window.speechSynthesis.speak(speech);
        return true;
    }
    return false;
}