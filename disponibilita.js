// Utilizziamo il wrapper Firebase invece degli import ES6
// Tutte le funzioni Firebase saranno disponibili tramite window.firebaseWrapper

// Funzione per mostrare toast notifications
function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    if (!toast) {
        console.error("Elemento toast non trovato nel DOM");
        console.log(message); // Stampa almeno il messaggio nella console
        return;
    }
    const toastMessage = toast.querySelector('.toast-message');
    const icon = toast.querySelector('.icon i');
    
    toastMessage.textContent = message;
    
    if (isError) {
        icon.className = 'fas fa-times-circle';
        toast.classList.add('toast-error');
    } else {
        icon.className = 'fas fa-check-circle';
        toast.classList.remove('toast-error');
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Configurazione Firebase è già gestita nel firebase-wrapper.js

// Variabili per gestire i tentativi di connessione
let retryAttempts = 0;
const MAX_RETRY = 3;
const RETRY_DELAY = 2000; // 2 secondi

// Variabili globali per Firebase
let db;

// Variabili globali per il calendario
let currentDate = new Date();
let currentMonth = currentDate.getMonth();
let currentYear = currentDate.getFullYear();
let selectedDate = null; // Mantiene la data selezionata dal calendario (YYYY-MM-DD)
let availabilityByDate = {};

// Elementi del DOM (inizializzati in DOMContentLoaded)
let calendarGrid = null;
let currentMonthElement = null;
let prevMonthButton = null;
let nextMonthButton = null;
let selectedDateElement = null; // Elemento per mostrare "Disponibilità per il GG/MM/AAAA"
let dateInput = null; // Campo input type="date" nel form
let tableBody = null; 

// Verifica la connessione a Internet
function checkInternetConnection() {
  return navigator.onLine;
}

// Funzione per riprovare un'operazione fallita
function retryOperation(operation, retries = MAX_RETRY) {
    if (retries <= 0) {
        showToast("Impossibile completare l'operazione dopo diversi tentativi.", true);
        return;
    }
    
    setTimeout(() => {
        try {
            operation()
            .then(() => {
                showToast("Operazione completata con successo dopo il nuovo tentativo!");
            })
            .catch(error => {
                console.error(`Tentativo fallito (rimasti ${retries} tentativi):`, error);
                retryOperation(operation, retries - 1);
            });
        } catch (error) {
            console.error(`Errore nel tentativo (rimasti ${retries} tentativi):`, error);
            retryOperation(operation, retries - 1);
        }
    }, RETRY_DELAY);
}

// Funzione per caricare tutte le disponibilità dal database
function loadAvailability() {
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return;
    }
    if (!window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
        console.warn("Disponibilita: Firebase Wrapper non pronto, loadAvailability posticipato.");
        return;
    }
    
    try {
        const firebaseFunctions = window.firebaseWrapper;
        db = firebaseFunctions.getDatabase(); 
        if (!db) {
            console.error("Disponibilita: Impossibile ottenere l'istanza del database da FirebaseWrapper.");
            showToast("Errore di connessione al database. Riprova più tardi.", true);
            return;
        }
        
        const disponibilitaRef = firebaseFunctions.ref("disponibilita");
        const onValueFn = firebaseFunctions.onValue;
            
        console.log("Disponibilita: Inizio caricamento disponibilità da Firebase...");
        onValueFn(disponibilitaRef, (snapshot) => {
            console.log("Disponibilita: Dati ricevuti da Firebase.");
            availabilityByDate = {}; 
            let datesLoaded = 0;
            
            if (snapshot.exists()) {
                try {
                    snapshot.forEach((dateSnapshot) => { 
                        const dateKey = dateSnapshot.key;
                        const slotsForDate = dateSnapshot.val();
                        
                        if (slotsForDate && typeof slotsForDate === 'object') {
                            availabilityByDate[dateKey] = [];
                            let slotsProcessedForDate = 0;
                            for (const slotKey in slotsForDate) {
                                const slot = slotsForDate[slotKey];
                                if (slot && typeof slot.startTime === 'string' && typeof slot.endTime === 'string') { 
                                    availabilityByDate[dateKey].push({
                                        id: slotKey, 
                                        data: dateKey, 
                                        ...slot
                                    });
                                    slotsProcessedForDate++;
                                } else {
                                    console.warn(`Disponibilita: Slot ${slotKey} per data ${dateKey} non valido o incompleto:`, slot);
                                }
                            }
                            if (slotsProcessedForDate > 0) datesLoaded++;
                        } else {
                            console.warn(`Disponibilita: Dati per la data ${dateKey} non sono un oggetto valido:`, slotsForDate);
                        }
                    });
                    if (datesLoaded > 0) console.log(`Disponibilita: Caricamento disponibilità completato. ${datesLoaded} date con slot caricate.`);
                    else console.log("Disponibilita: Nessuna data con disponibilità attiva trovata nel database.");
                } catch (processingError) {
                    console.error("Disponibilita: Errore durante l'elaborazione degli slot di disponibilità:", processingError);
                    showToast("Errore nell'elaborazione dei dati di disponibilità.", true);
                }
            } else {
                console.log("Disponibilita: Nessun dato di disponibilità trovato nel database (snapshot non esistente).");
            }
            
            if (calendarGrid && currentMonthElement) renderCalendar();
            renderAvailabilityTable(); 
            
            // Se una data era stata selezionata, aggiorna la vista della tabella per quella data.
            // Altrimenti, la tabella mostrerà tutte le disponibilità o "nessuna trovata".
            if (selectedDate && selectedDateElement) {
                 showAvailabilityForDate(selectedDate);
            } else if (selectedDateElement) { // Se non c'è selectedDate ma l'elemento esiste, resetta il titolo
                 selectedDateElement.textContent = 'Disponibilità correnti';
            }

        }, (error) => {
            console.error("Disponibilita: Errore Firebase nel caricamento delle disponibilità:", error);
            showToast("Errore nel caricamento delle disponibilità. Riprova più tardi.", true);
            if (retryAttempts < MAX_RETRY) {
                retryAttempts++; setTimeout(loadAvailability, RETRY_DELAY);
                showToast(`Tentativo di riconnessione ${retryAttempts}/${MAX_RETRY}...`);
            } else {
                showToast("Impossibile caricare le disponibilità. Ricarica la pagina.", true);
            }
        });
    } catch (error) { 
        console.error("Disponibilita: Errore durante l'impostazione del caricamento delle disponibilità:", error);
        showToast("Si è verificato un errore di configurazione. Riprova più tardi.", true);
    }
}

function addAvailability(data, orarioInizio, orarioFine, descrizione) {
    // ... (implementazione invariata, già logga e gestisce errori)
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return Promise.reject(new Error("Nessuna connessione Internet"));
    }
    if (!window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
        console.error("Disponibilita Form: FirebaseWrapper non pronto.");
        showToast("Servizio non pronto, riprova tra poco.", true);
        return Promise.reject(new Error("FirebaseWrapper non pronto"));
    }
    try {
        const firebaseFunctions = window.firebaseWrapper;
        const dateRef = firebaseFunctions.ref(`disponibilita/${data}`);
        const newSlotRef = firebaseFunctions.push(dateRef);
        return firebaseFunctions.set(newSlotRef, {
            startTime: orarioInizio, endTime: orarioFine, description: descrizione,
            isActive: true, isBooked: false
        }).then(() => {
            console.log(`Disponibilita: Dati salvati per ${data} ${orarioInizio}-${orarioFine} con ID ${newSlotRef.key}`);
            return newSlotRef; 
        }).catch(error => {
            console.error(`Disponibilita Form: Errore Firebase durante il salvataggio per ${data}:`, error);
            showToast(`Errore nel salvataggio: ${error.message || "Errore sconosciuto"}`, true);
            return Promise.reject(error); 
        });
    } catch (error) { 
        console.error("Disponibilita Form: Errore JS durante l'aggiunta:", error);
        showToast("Errore imprevisto durante l'aggiunta.", true);
        return Promise.reject(error);
    }
}

function migrateOldDataToNewFormat() {
    // ... (implementazione invariata, già logga e gestisce errori)
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return Promise.reject("Nessuna connessione Internet");
    }
    if (!window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
        console.error("Migrazione Dati: FirebaseWrapper non pronto.");
        showToast("Servizio non pronto per la migrazione, riprova tra poco.", true);
        return Promise.reject(new Error("FirebaseWrapper non pronto"));
    }
    console.log("Migrazione Dati: Avvio migrazione vecchi dati...");
    try {
        const firebaseFunctions = window.firebaseWrapper;
        const disponibilitaRef = firebaseFunctions.ref('disponibilita');
        return firebaseFunctions.get(disponibilitaRef).then(snapshot => { 
            if (!snapshot.exists()) {
                console.log("Migrazione Dati: Nessun dato da migrare.");
                showToast("Nessun dato da migrare.", false); return;
            }
            const updates = {}; let migrationNeeded = false;
            snapshot.forEach(child => { 
                const key = child.key; 
                const disponibilita = child.val();
                if (disponibilita && disponibilita.data && disponibilita.orarioInizio && !/^\d{4}-\d{2}-\d{2}$/.test(key)) {
                    migrationNeeded = true;
                    console.log(`Migrazione Dati: Trovato vecchio formato per ID ${key}, data ${disponibilita.data}`);
                    updates[`${disponibilita.data}/${key}`] = {
                        startTime: disponibilita.orarioInizio, endTime: disponibilita.orarioFine,
                        description: disponibilita.descrizione, isActive: true, isBooked: false
                    };
                    updates[key] = null; 
                }
            });
            if (!migrationNeeded) {
                console.log("Migrazione Dati: Nessuna migrazione necessaria.");
                showToast("Nessuna migrazione necessaria o dati già aggiornati.", false);
                return Promise.resolve();
            }
            console.log("Migrazione Dati: Esecuzione aggiornamenti Firebase...", updates);
            return firebaseFunctions.update(disponibilitaRef, updates).then(() => {
                console.log("Migrazione Dati: Migrazione completata.");
                showToast("Migrazione dati completata!", false);
            }).catch(error => {
                console.error("Migrazione Dati: Errore Firebase update:", error);
                showToast("Errore aggiornamento dati migrati.", true);
                return Promise.reject(error);
            });
        });
    } catch (error) {
        console.error("Migrazione Dati: Errore JS:", error);
        showToast("Errore durante la migrazione.", true);
        return Promise.reject(error);
    }
}

function initDOMElements() {
    // ... (implementazione invariata)
    calendarGrid = document.querySelector('.calendar-grid');
    currentMonthElement = document.getElementById('currentMonth');
    prevMonthButton = document.getElementById('prevMonth');
    nextMonthButton = document.getElementById('nextMonth');
    selectedDateElement = document.getElementById('selectedDate');
    dateInput = document.getElementById('data');
    tableBody = document.querySelector('#tabellaDisponibilita tbody'); 
    if (prevMonthButton && !prevMonthButton._hasClickListener) {
        prevMonthButton.addEventListener('click', () => {
            currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } renderCalendar();
        });
        prevMonthButton._hasClickListener = true;
    }
    if (nextMonthButton && !nextMonthButton._hasClickListener) {
        nextMonthButton.addEventListener('click', () => {
            currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } renderCalendar();
        });
        nextMonthButton._hasClickListener = true;
    }
}

function formatDateIT(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

function renderCalendar() {
    // ... (implementazione invariata, ma il click listener ora pre-popola il form)
    if (!calendarGrid || !currentMonthElement) return;
    try {
        const monthNames = ["Gennaio","Febbraio","Marzo","Aprile","Maggio","Giugno","Luglio","Agosto","Settembre","Ottobre","Novembre","Dicembre"];
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        calendarGrid.querySelectorAll('.day').forEach(day => day.remove());
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        const adjustedFirstDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        for (let i = 0; i < adjustedFirstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty'; calendarGrid.appendChild(emptyDay);
        }
        const today = new Date();
        const todayDateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day'; dayElement.textContent = day;
            const dateString = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            if (dateString === todayDateString) dayElement.classList.add('today');
            if (availabilityByDate[dateString] && availabilityByDate[dateString].length > 0) dayElement.classList.add('has-slots');
            if (selectedDate === dateString) dayElement.classList.add('selected');
            
            dayElement.addEventListener('click', () => {
                if (!dateInput) { console.error("Disponibilita Calendar: dateInput non trovato."); return; }
                document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
                dayElement.classList.add('selected');
                selectedDate = dateString; // Aggiorna la variabile globale
                dateInput.value = selectedDate; // Pre-popola il campo data del form
                if (selectedDateElement) showAvailabilityForDate(selectedDate);
                else renderAvailabilityTable(); 
            });
            calendarGrid.appendChild(dayElement);
        }
    } catch (error) {
        console.error("Disponibilita: Errore renderCalendar:", error);
        showToast("Errore visualizzazione calendario.", true);
    }
}

function showAvailabilityForDate(date) {
    // ... (implementazione invariata)
    if (selectedDateElement) selectedDateElement.textContent = `Disponibilità per il ${formatDateIT(date)}`;
    try {
        const filteredAvailability = availabilityByDate[date] || [];
        renderAvailabilityTable(filteredAvailability); 
    } catch (error) {
        console.error(`Disponibilita: Errore showAvailabilityForDate ${date}:`, error);
        showToast("Errore visualizzazione disponibilità.", true);
    }
}

function renderAvailabilityTable(disponibilita = null) {
    // ... (implementazione invariata, ma il delete button ora usa data-date)
    if (!tableBody) return;
    try {
        let allDisponibilitaToShow = [];
        if (disponibilita === null) {
            for (const date in availabilityByDate) { if (availabilityByDate[date]) allDisponibilitaToShow.push(...availabilityByDate[date]); }
        } else { allDisponibilitaToShow = disponibilita; }
        tableBody.innerHTML = ''; 
        if (allDisponibilitaToShow.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" style="text-align: center; font-style: italic;">Nessuna disponibilità trovata</td>`;
            tableBody.appendChild(row); return;
        }
        allDisponibilitaToShow.sort((a, b) => {
            if (a.data === b.data) return a.startTime.localeCompare(b.startTime);
            return a.data.localeCompare(b.data);
        });
        allDisponibilitaToShow.forEach(disp => {
            const row = document.createElement('tr');
            const orario = `${disp.startTime} - ${disp.endTime}`;
            const dataFormatted = disp.data ? formatDateIT(disp.data) : 'Data non specificata';
            row.innerHTML = `
                <td>${dataFormatted}</td> <td>${orario}</td> <td>${disp.description || ''}</td>
                <td><button class="delete-btn" data-id="${disp.id}" data-date="${disp.data || ''}"><i class="fas fa-trash-alt"></i> Elimina</button></td>`;
            
            row.querySelector('.delete-btn').addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                const slotDate = this.getAttribute('data-date');
                if (!slotDate || !id) {
                    console.error("Disponibilita Table Delete: ID slot o data mancante.");
                    showToast("Errore: ID slot o data mancante.", true); return;
                }
                if (confirm(`Sei sicuro di voler eliminare disponibilità (${slotDate} - ${orario})?`)) {
                    const firebaseFunctions = window.firebaseWrapper;
                    this.disabled = true; this.style.opacity = "0.5"; this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
                    const firebasePath = `disponibilita/${slotDate}/${id}`; 
                    console.log(`Disponibilita Table: Tentativo eliminazione slot ID: ${id}, Path: ${firebasePath}`);
                    try {
                        firebaseFunctions.remove(firebaseFunctions.ref(firebasePath))
                            .then(() => {
                                console.log(`Disponibilita Table: Slot ${id} eliminato da ${firebasePath}`);
                                showToast("Disponibilità eliminata!");
                            })
                            .catch(error => {
                                console.error(`Disponibilita Table: Errore Firebase eliminazione slot ID ${id} da ${firebasePath}:`, error);
                                showToast(`Errore eliminazione: ${error.message || "Errore sconosciuto."}`, true);
                                this.disabled = false; this.style.opacity = "1"; this.innerHTML = '<i class="fas fa-trash-alt"></i> Elimina';
                            });
                    } catch (syncError) { 
                        console.error(`Disponibilita Table: Errore JS preparazione eliminazione slot ID ${id}:`, syncError);
                        showToast("Errore imprevisto eliminazione.", true);
                        this.disabled = false; this.style.opacity = "1"; this.innerHTML = '<i class="fas fa-trash-alt"></i> Elimina';
                    }
                }
            });
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Disponibilita: Errore renderAvailabilityTable:", error);
        showToast("Errore visualizzazione tabella.", true);
    }
}

function initializeDisponibilitaApp() {
    console.log("Disponibilita: Initializing app components...");
    initDOMElements();

    const aggiungiBtn = document.getElementById("aggiungiDisponibilita");
    if (aggiungiBtn) {
        aggiungiBtn.addEventListener("click", function(e) {
            e.preventDefault();
            if (!checkInternetConnection()) { showToast("Nessuna connessione Internet.", true); return; }
            
            const dataInputForm = document.getElementById("data"); // Riferimento corretto
            const orarioInizioInput = document.getElementById("orarioInizio");
            const orarioFineInput = document.getElementById("orarioFine");
            const descrizioneInput = document.getElementById("descrizione");
            
            if (!dataInputForm || !orarioInizioInput || !orarioFineInput || !descrizioneInput) {
                console.error("Disponibilita Form: Elementi del form non trovati.");
                showToast("Errore: elementi del form non trovati.", true); return;
            }
            
            let dataToSave = dataInputForm.value; // Usa let per poterla modificare
            const orarioInizio = orarioInizioInput.value;
            const orarioFine = orarioFineInput.value;
            const descrizione = descrizioneInput.value;

            // Se il campo data del form è vuoto MA una data è stata selezionata dal calendario, usa quella.
            if (!dataToSave && selectedDate) {
                dataToSave = selectedDate;
                console.log(`Disponibilita Form: Campo data vuoto, utilizzo data selezionata dal calendario: ${dataToSave}`);
            }
            
            console.log(`Disponibilita Form: Tentativo aggiunta. Data: ${dataToSave}, Inizio: ${orarioInizio}, Fine: ${orarioFine}, Desc: ${descrizione}.`);
            
            if (!dataToSave || !orarioInizio || !orarioFine ) { 
                showToast("Inserisci Data, Ora Inizio e Ora Fine.", true); return;
            }
            if (orarioInizio >= orarioFine) {
                showToast("L'ora di fine deve essere successiva all'ora di inizio.", true); return;
            }
            
            aggiungiBtn.disabled = true; aggiungiBtn.style.opacity = "0.7";
            const originalButtonText = aggiungiBtn.innerHTML;
            aggiungiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
            
            addAvailability(dataToSave, orarioInizio, orarioFine, descrizione)
                .then((newSlotRef) => { 
                    if(dataInputForm) dataInputForm.value = ""; // Pulisci anche il campo data
                    if (orarioInizioInput) orarioInizioInput.value = "";
                    if (orarioFineInput) orarioFineInput.value = "";
                    if (descrizioneInput) descrizioneInput.value = "";
                    
                    const slotId = newSlotRef && newSlotRef.key ? newSlotRef.key : 'N/A';
                    console.log(`Disponibilita Form: Aggiunta successo ID: ${slotId} path: disponibilita/${dataToSave}/${slotId}`);
                    showToast("Disponibilità aggiunta con successo!");
                    // Non è necessario notificare l'AI Assistant qui, il listener onValue aggiornerà i dati per tutti.
                })
                .catch(error => { /* Errore già gestito e loggato da addAvailability */ })
                .finally(() => {
                    aggiungiBtn.disabled = false; aggiungiBtn.style.opacity = "1";
                    aggiungiBtn.innerHTML = originalButtonText;
                });
        });
    }

    const today = new Date();
    const formattedDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    // Imposta la data di default nel form e come selectedDate globale se il calendario è presente
    if (dateInput) {
        if (!dateInput.value) dateInput.value = formattedDate; // Imposta il campo data del form
        if (calendarGrid) selectedDate = dateInput.value; // Sincronizza selectedDate globale
    }
    
    const footerArea = document.querySelector('.footer-area');
    if (footerArea) {
        // ... (codice bottone migrazione invariato)
        const migrateButton = document.createElement('button');
        migrateButton.className = 'button'; migrateButton.style.marginRight = '10px';
        migrateButton.innerHTML = '<i class="fas fa-sync-alt"></i> Migra dati vecchi';
        migrateButton.addEventListener('click', function() {
            if (confirm("Vuoi migrare i dati delle disponibilità dal vecchio al nuovo formato?")) {
                this.disabled = true; this.style.opacity = "0.7";
                const originalButtonText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Migrazione in corso...';
                migrateOldDataToNewFormat()
                    .then(() => { 
                        this.innerHTML = '<i class="fas fa-check"></i> Migrazione completata';
                        setTimeout(() => { this.innerHTML = originalButtonText; this.disabled = false; this.style.opacity = "1"; location.reload(); }, 2000);
                    })
                    .catch(error => { this.innerHTML = originalButtonText; this.disabled = false; this.style.opacity = "1"; });
            }
        });
        footerArea.insertBefore(migrateButton, footerArea.firstChild);
    }
    
    window.connectionWasOnline = navigator.onLine;
    loadAvailability(); 
    retryAttempts = 0; 
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("Disponibilita: DOMContentLoaded. Verifico stato Firebase...");
    if (window.firebaseWrapper && window.firebaseWrapper.isInitialized) {
        console.log("Disponibilita: Firebase già inizializzato. Avvio app.");
        initializeDisponibilitaApp();
    } else {
        console.log("Disponibilita: Firebase non inizializzato. In ascolto evento firebase-ready.");
        document.addEventListener('firebase-ready', () => {
            console.log("Disponibilita: Evento firebase-ready ricevuto. Avvio app.");
            initializeDisponibilitaApp();
        }, { once: true });
        setTimeout(() => {
            if (window.firebaseWrapper && window.firebaseWrapper.isInitialized && !calendarGrid) { 
                 console.log("Disponibilita: Fallback check - Firebase pronto, app non inizializzata. Avvio app.");
                 initializeDisponibilitaApp();
            } else if (!window.firebaseWrapper || !window.firebaseWrapper.isInitialized) {
                console.warn("Disponibilita: Firebase non pronto dopo fallback. UI potrebbe non funzionare.");
                showToast("Errore connessione servizi. Ricarica pagina.", true);
            }
        }, 1500); 
    }
});

setInterval(() => {
    // ... (implementazione invariata)
    const online = checkInternetConnection();
    if (!online && window.connectionWasOnline !== false) {
        showToast("Connessione Internet persa. Alcune funzioni potrebbero non funzionare.", true);
        window.connectionWasOnline = false;
    } else if (online && window.connectionWasOnline === false) {
        showToast("Connessione Internet ripristinata!");
        window.connectionWasOnline = true;
        if (window.firebaseWrapper && window.firebaseWrapper.isInitialized) loadAvailability(); 
        else console.warn("Disponibilita: Connessione ripristinata, Firebase non pronto.");
    }
}, 5000);
