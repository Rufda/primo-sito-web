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
let selectedDate = null;
let availabilityByDate = {};

// Elementi del DOM (inizializzati in DOMContentLoaded)
let calendarGrid = null;
let currentMonthElement = null;
let prevMonthButton = null;
let nextMonthButton = null;
let selectedDateElement = null;
let dateInput = null;
let tableBody = null; // Aggiunto per la tabella

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
    // Verifica la connessione a Internet
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return;
    }
    
    try {
        const firebaseFunctions = window.firebaseWrapper;
        if (!firebaseFunctions) {
            console.error("FirebaseWrapper non disponibile");
            showToast("Errore di connessione al database. Ricarica la pagina.", true);
            return;
        }

        db = typeof firebase !== 'undefined' ? firebase.database() : firebaseFunctions.getDatabase();
        
        const disponibilitaRef = typeof firebase !== 'undefined' 
            ? firebase.database().ref("disponibilita") 
            : firebaseFunctions.ref("disponibilita");
            
        const onValueFn = typeof firebase !== 'undefined'
            ? (ref, callback, errorCallback) => ref.on('value', callback, errorCallback)
            : firebaseFunctions.onValue;
            
        onValueFn(disponibilitaRef, (snapshot) => {
            // Resetta l'oggetto delle disponibilità
            availabilityByDate = {};
            
            if (snapshot.exists()) {
                snapshot.forEach((child) => {
                    const disponibilita = child.val();
                    const key = child.key;
                    
                    if (disponibilita) {
                        // Organizza le disponibilità per data
                        if (!availabilityByDate[key]) {
                            availabilityByDate[key] = [];
                        }
                        
                        for (const slotKey in disponibilita) {
                            const slot = disponibilita[slotKey];
                            availabilityByDate[key].push({
                                id: slotKey,
                                ...slot
                            });
                        }
                    }
                });
            }
            
            // Aggiorna il calendario con le nuove disponibilità se gli elementi sono disponibili
            if (calendarGrid && currentMonthElement) {
                renderCalendar();
            }
            
            // Aggiorna la tabella delle disponibilità
            renderAvailabilityTable(); // La funzione ora controlla se tableBody esiste
            
            // Se c'è una data selezionata, mostra le disponibilità per quella data
            if (selectedDate && selectedDateElement) {
                showAvailabilityForDate(selectedDate);
            }
        }, (error) => {
            console.error("Errore nel caricamento delle disponibilità:", error);
            showToast("Errore nel caricamento delle disponibilità. Riprova più tardi.", true);
            
            // Riprova a caricare i dati
            if (retryAttempts < MAX_RETRY) {
                retryAttempts++;
                setTimeout(loadAvailability, RETRY_DELAY);
                showToast(`Tentativo di riconnessione ${retryAttempts}/${MAX_RETRY}...`);
            } else {
                showToast("Impossibile caricare le disponibilità. Ricarica la pagina.", true);
            }
        });
    } catch (error) {
        console.error("Errore durante il caricamento delle disponibilità:", error);
        showToast("Si è verificato un errore. Riprova più tardi.", true);
    }
}

// Funzione per aggiungere una nuova disponibilità
function addAvailability(data, orarioInizio, orarioFine, descrizione) {
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return Promise.reject("Nessuna connessione Internet");
    }
    
    try {
        const firebaseFunctions = window.firebaseWrapper;
        const refFn = typeof firebase !== 'undefined'
            ? (path) => firebase.database().ref(path)
            : firebaseFunctions.ref;
        
        // Usa la data come chiave principale per raggruppare le disponibilità per giorno
        const dateRef = refFn(`disponibilita/${data}`);
        
        // Genera un ID univoco per questa disponibilità all'interno del nodo della data
        const newSlotRef = dateRef.push();
        
        // Salva i dati della disponibilità
        return newSlotRef.set({
            startTime: orarioInizio,
            endTime: orarioFine,
            description: descrizione,
            isActive: true,  // Imposta esplicitamente isActive a true
            isBooked: false  // Imposta esplicitamente isBooked a false
        });
    } catch (error) {
        console.error("Errore durante l'aggiunta della disponibilità:", error);
        return Promise.reject(error);
    }
}

// Funzione per migrare vecchie disponibilità al nuovo formato
function migrateOldDataToNewFormat() {
    if (!checkInternetConnection()) {
        showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
        return Promise.reject("Nessuna connessione Internet");
    }
    
    try {
        const firebaseFunctions = window.firebaseWrapper;
        const refFn = typeof firebase !== 'undefined'
            ? (path) => firebase.database().ref(path)
            : firebaseFunctions.ref;
        
        // Riferimento al nodo principale delle disponibilità
        const disponibilitaRef = refFn('disponibilita');
        
        return disponibilitaRef.once('value').then(snapshot => {
            if (!snapshot.exists()) {
                console.log("Nessun dato di disponibilità da migrare");
                return;
            }
            
            const updates = {};
            let migrationNeeded = false;
            
            snapshot.forEach(child => {
                const disponibilita = child.val();
                const key = child.key;
                
                // Verifica se è nel vecchio formato (ha un campo 'data')
                if (disponibilita && disponibilita.data) {
                    migrationNeeded = true;
                    console.log(`Migrazione disponibilità con ID ${key} alla data ${disponibilita.data}`);
                    
                    // Crea un nuovo slot con il formato corretto
                    const newSlotData = {
                        startTime: disponibilita.orarioInizio,
                        endTime: disponibilita.orarioFine,
                        description: disponibilita.descrizione,
                        isActive: true,
                        isBooked: false
                    };
                    
                    // Aggiungi all'oggetto updates
                    updates[`${disponibilita.data}/${key}`] = newSlotData;
                    
                    // Elimina il vecchio record
                    updates[key] = null;
                }
            });
            
            if (!migrationNeeded) {
                console.log("Tutti i dati sono già nel formato corretto");
                return Promise.resolve();
            }
            
            // Esegui gli aggiornamenti in un'unica transazione
            return disponibilitaRef.update(updates).then(() => {
                console.log("Migrazione completata con successo");
                showToast("Migrazione dei dati completata con successo!");
            });
        });
    } catch (error) {
        console.error("Errore durante la migrazione dei dati:", error);
        showToast("Errore durante la migrazione dei dati", true);
        return Promise.reject(error);
    }
}

// Funzione per inizializzare gli elementi DOM (chiamata da DOMContentLoaded)
function initDOMElements() {
    calendarGrid = document.querySelector('.calendar-grid');
    currentMonthElement = document.getElementById('currentMonth');
    prevMonthButton = document.getElementById('prevMonth');
    nextMonthButton = document.getElementById('nextMonth');
    selectedDateElement = document.getElementById('selectedDate');
    dateInput = document.getElementById('data');
    tableBody = document.querySelector('#tabellaDisponibilita tbody'); // Inizializza tableBody
    
    if (prevMonthButton && !prevMonthButton._hasClickListener) {
        prevMonthButton.addEventListener('click', () => {
            currentMonth--;
            if (currentMonth < 0) {
                currentMonth = 11;
                currentYear--;
            }
            renderCalendar();
        });
        prevMonthButton._hasClickListener = true;
    }

    if (nextMonthButton && !nextMonthButton._hasClickListener) {
        nextMonthButton.addEventListener('click', () => {
            currentMonth++;
            if (currentMonth > 11) {
                currentMonth = 0;
                currentYear++;
            }
            renderCalendar();
        });
        nextMonthButton._hasClickListener = true;
    }
}

// Funzione per formattare una data nel formato italiano
function formatDateIT(dateStr) {
    if (!dateStr) return '';
    
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
}

// Funzione per renderizzare il calendario
function renderCalendar() {
    if (!calendarGrid || !currentMonthElement) {
        return;
    }

    try {
        // Aggiorna il titolo del mese
        const monthNames = ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"];
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;
        
        // Rimuovi tutti i giorni esistenti, tranne i nomi dei giorni
        const daysElements = calendarGrid.querySelectorAll('.day');
        daysElements.forEach(day => day.remove());
        
        // Ottieni il primo giorno del mese (0 = Domenica, 1 = Lunedì, ...)
        const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
        
        // Adatta l'indice del giorno per iniziare con lunedì (0 = Lunedì, 6 = Domenica)
        const adjustedFirstDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
        
        // Numero di giorni nel mese corrente
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        
        // Aggiungi celle vuote per i giorni prima del primo del mese
        for (let i = 0; i < adjustedFirstDay; i++) {
            const emptyDay = document.createElement('div');
            emptyDay.className = 'day empty';
            calendarGrid.appendChild(emptyDay);
        }
        
        // Ottieni la data odierna per evidenziarla
        const today = new Date();
        const todayDateString = today.getFullYear() + '-' + 
                               String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                               String(today.getDate()).padStart(2, '0');
        
        // Aggiungi i giorni del mese
        for (let day = 1; day <= daysInMonth; day++) {
            const dayElement = document.createElement('div');
            dayElement.className = 'day';
            dayElement.textContent = day;
            
            // Formatta la data in formato YYYY-MM-DD per confrontarla con le disponibilità
            const dateString = currentYear + '-' + 
                             String(currentMonth + 1).padStart(2, '0') + '-' + 
                             String(day).padStart(2, '0');
            
            // Evidenzia il giorno odierno
            if (dateString === todayDateString) {
                dayElement.classList.add('today');
            }
            
            // Evidenzia i giorni con disponibilità
            if (availabilityByDate[dateString] && availabilityByDate[dateString].length > 0) {
                dayElement.classList.add('has-slots');
            }
            
            // Evidenzia il giorno selezionato
            if (selectedDate === dateString) {
                dayElement.classList.add('selected');
            }
            
            // Event listener per selezionare il giorno
            dayElement.addEventListener('click', () => {
                // Verifichiamo che dateInput esista prima di usarlo
                if (!dateInput) {
                    console.error("Elemento data non trovato nel DOM per l'aggiornamento.");
                    return; // Esce se dateInput non è disponibile
                }
                
                // Rimuovi la classe selected da tutti i giorni
                document.querySelectorAll('.day.selected').forEach(el => {
                    el.classList.remove('selected');
                });
                
                // Aggiungi la classe selected al giorno cliccato
                dayElement.classList.add('selected');
                
                // Imposta la data selezionata
                selectedDate = dateString;
                
                // Aggiorna il campo data nel form
                dateInput.value = selectedDate;
                
                // Mostra le disponibilità per la data selezionata (controlla se selectedDateElement esiste)
                if (selectedDateElement) {
                    showAvailabilityForDate(selectedDate);
                } else {
                    renderAvailabilityTable();
                }
            });
            
            calendarGrid.appendChild(dayElement);
        }
    } catch (error) {
        console.error("Errore nella renderizzazione del calendario:", error);
        showToast("Errore nella visualizzazione del calendario.", true);
    }
}

// Funzione per mostrare le disponibilità di una data specifica
function showAvailabilityForDate(date) {
    if (selectedDateElement) {
        selectedDateElement.textContent = `Disponibilità per il ${formatDateIT(date)}`;
    }
    
    try {
        const filteredAvailability = availabilityByDate[date] || [];
        renderAvailabilityTable(filteredAvailability);
    } catch (error) {
        console.error("Errore nella visualizzazione delle disponibilità per data:", error);
        showToast("Errore nella visualizzazione delle disponibilità.", true);
    }
}

// Funzione per renderizzare la tabella delle disponibilità
function renderAvailabilityTable(disponibilita = null) {
    if (!tableBody) {
        return;
    }
    
    try {
        let allDisponibilitaToShow = [];
        if (disponibilita === null) {
            for (const date in availabilityByDate) {
                if (availabilityByDate[date]) {
                    allDisponibilitaToShow.push(...availabilityByDate[date]);
                }
            }
        } else {
            allDisponibilitaToShow = disponibilita;
        }
        
        tableBody.innerHTML = '';
        
        if (allDisponibilitaToShow.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="4" style="text-align: center; font-style: italic;">Nessuna disponibilità trovata</td>`;
            tableBody.appendChild(row);
            return;
        }
        
        allDisponibilitaToShow.sort((a, b) => {
            if (a.data === b.data) {
                return a.startTime.localeCompare(b.startTime);
            }
            return a.data.localeCompare(b.data);
        });
        
        allDisponibilitaToShow.forEach(disp => {
            const row = document.createElement('tr');
            
            const orario = `${disp.startTime} - ${disp.endTime}`;
            row.innerHTML = `
                <td>${formatDateIT(disp.data)}</td>
                <td>${orario}</td>
                <td>${disp.description}</td>
                <td>
                    <button class="delete-btn" data-id="${disp.id}">
                        <i class="fas fa-trash-alt"></i> Elimina
                    </button>
                </td>
            `;
            
            row.querySelector('.delete-btn').addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                if (confirm("Sei sicuro di voler eliminare questa disponibilità?")) {
                    const firebaseFunctions = window.firebaseWrapper;
                    this.disabled = true;
                    this.style.opacity = "0.5";
                    this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Eliminando...';
                    
                    try {
                        const removeFn = typeof firebase !== 'undefined'
                            ? (ref) => ref.remove()
                            : firebaseFunctions.remove;

                        const refFn = typeof firebase !== 'undefined'
                            ? (path) => firebase.database().ref(path)
                            : firebaseFunctions.ref;

                        const disponibilitaRef = refFn(`disponibilita/${disp.data}/${id}`);
                        removeFn(disponibilitaRef)
                            .then(() => {
                                showToast("Disponibilità eliminata con successo!");
                            })
                            .catch(error => {
                                console.error("Errore nell'eliminazione della disponibilità:", error);
                                showToast("Si è verificato un errore. Riprova più tardi.", true);
                                
                                this.disabled = false;
                                this.style.opacity = "1";
                                this.innerHTML = '<i class="fas fa-trash-alt"></i> Elimina';
                                
                                retryOperation(() => removeFn(refFn(`disponibilita/${disp.data}/${id}`)));
                            });
                    } catch (error) {
                        console.error("Errore durante l'eliminazione:", error);
                        showToast("Si è verificato un errore. Riprova più tardi.", true);
                        
                        this.disabled = false;
                        this.style.opacity = "1";
                        this.innerHTML = '<i class="fas fa-trash-alt"></i> Elimina';
                    }
                }
            });
            
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error("Errore nella renderizzazione della tabella:", error);
        showToast("Errore nella visualizzazione della tabella.", true);
    }
}

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    // Assicuriamoci che il wrapper Firebase sia disponibile
    if (!window.firebaseWrapper) {
        console.error("Firebase wrapper non disponibile");
        showToast("Errore di inizializzazione. Ricarica la pagina.", true);
    } else {
        console.log("Firebase wrapper trovato, inizializzazione in corso...");
    }

    initDOMElements();
    
    const aggiungiBtn = document.getElementById("aggiungiDisponibilita");
    if (aggiungiBtn) {
        aggiungiBtn.addEventListener("click", function(e) {
            e.preventDefault();
            
            if (!checkInternetConnection()) {
                showToast("Nessuna connessione Internet. Verifica la tua connessione e riprova.", true);
                return;
            }
            
            const dataInputForm = document.getElementById("data");
            const orarioInizioInput = document.getElementById("orarioInizio");
            const orarioFineInput = document.getElementById("orarioFine");
            const descrizioneInput = document.getElementById("descrizione");
            
            // Verifica che tutti gli elementi del form esistano
            if (!dataInputForm || !orarioInizioInput || !orarioFineInput || !descrizioneInput) {
                showToast("Errore: elementi del form non trovati.", true);
                return;
            }
            
            const data = dataInputForm.value;
            const orarioInizio = orarioInizioInput.value;
            const orarioFine = orarioFineInput.value;
            const descrizione = descrizioneInput.value;
            
            // Aggiungi stili inline per AI Assistant se non presenti
            if (!document.querySelector('#ai-assistant-inline-styles')) {
                const styles = document.createElement('style');
                styles.id = 'ai-assistant-inline-styles';
                styles.textContent = `
                    .ai-assistant-container { position: fixed !important; bottom: 20px !important; right: 20px !important; z-index: 9999 !important; }
                    .ai-assistant-button { width: 60px !important; height: 60px !important; background: linear-gradient(135deg, #667eea, #764ba2, #f093fb) !important; color: white !important; border-radius: 50% !important; display: flex !important; align-items: center !important; justify-content: center !important; cursor: pointer !important; box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important; border: none !important; font-size: 18px !important; }
                    .ai-assistant-chatbox { position: fixed !important; bottom: 90px !important; right: 20px !important; width: 350px !important; height: 450px !important; background: white !important; border-radius: 12px !important; box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; display: none !important; flex-direction: column !important; border: 1px solid #e0e0e0 !important; }
                    .ai-assistant-chatbox.active { display: flex !important; }
                `;
                document.head.appendChild(styles);
            }
            
            if (!data || !orarioInizio || !orarioFine || !descrizione) {
                showToast("Inserisci tutti i dati correttamente.", true);
                return;
            }
            
            if (orarioInizio >= orarioFine) {
                showToast("L'ora di fine deve essere successiva all'ora di inizio.", true);
                return;
            }
            
            aggiungiBtn.disabled = true;
            aggiungiBtn.style.opacity = "0.7";
            const originalButtonText = aggiungiBtn.innerHTML;
            aggiungiBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvataggio...';
            
            // Usa la nuova funzione addAvailability
            addAvailability(data, orarioInizio, orarioFine, descrizione)
                .then(() => {
                    if (orarioInizioInput) orarioInizioInput.value = "";
                    if (orarioFineInput) orarioFineInput.value = "";
                    if (descrizioneInput) descrizioneInput.value = "";
                    
                    showToast("Disponibilità aggiunta con successo!");
                    
                    // Notifica l'AI dell'operazione
                    if (window.aiAssistantNotifyAvailabilityAdded) {
                        window.aiAssistantNotifyAvailabilityAdded({
                            date: data,
                            startTime: orarioInizio,
                            endTime: orarioFine,
                            description: descrizione
                        });
                    }
                })
                .catch(error => {
                    console.error("Errore nell'aggiunta della disponibilità:", error);
                    showToast("Si è verificato un errore. Riprova più tardi.", true);
                    
                    retryOperation(() => {
                        return addAvailability(data, orarioInizio, orarioFine, descrizione);
                    });
                })
                .finally(() => {
                    aggiungiBtn.disabled = false;
                    aggiungiBtn.style.opacity = "1";
                    aggiungiBtn.innerHTML = originalButtonText;
                });
        });
    }

    // Funzioni globali per permettere all'AI di gestire le disponibilità
    window.addAvailabilityFromAI = async function(date, startTime, endTime, description = '') {
        try {
            await addAvailability(date, startTime, endTime, description);
            renderCalendar(); // Aggiorna il calendario
            renderAvailabilityTable(); // Aggiorna la tabella
            return { success: true };
        } catch (error) {
            throw new Error(`Errore nell'aggiunta: ${error.message}`);
        }
    };

    window.removeAvailabilityFromAI = async function(date, startTime) {
        const slots = availabilityByDate[date];
        if (!slots) throw new Error("Nessuna disponibilità trovata per questa data");
        
        let slotToRemove = null;
        for (const slot of slots) {
            if (slot.startTime === startTime) {
                slotToRemove = slot;
                break;
            }
        }
        
        if (!slotToRemove) throw new Error("Slot non trovato");
        
        try {
            const firebaseFunctions = window.firebaseWrapper;
            const refFn = typeof firebase !== 'undefined'
                ? (path) => firebase.database().ref(path)
                : firebaseFunctions.ref;
            const removeFn = typeof firebase !== 'undefined'
                ? (ref) => ref.remove()
                : firebaseFunctions.remove;

            const disponibilitaRef = refFn(`disponibilita/${date}/${slotToRemove.id}`);
            await removeFn(disponibilitaRef);
            
            renderCalendar();
            renderAvailabilityTable();
            return { success: true };
        } catch (error) {
            throw new Error(`Errore nella rimozione: ${error.message}`);
        }
    };

    const today = new Date();
    const formattedDate = today.getFullYear() + '-' + 
                        String(today.getMonth() + 1).padStart(2, '0') + '-' + 
                        String(today.getDate()).padStart(2, '0');
    
    // Aggiungi pulsante di migrazione (opzionale - solo per test)
    const footerArea = document.querySelector('.footer-area');
    if (footerArea) {
        const migrateButton = document.createElement('button');
        migrateButton.className = 'button';
        migrateButton.style.marginRight = '10px';
        migrateButton.innerHTML = '<i class="fas fa-sync-alt"></i> Migra dati vecchi';
        migrateButton.addEventListener('click', function() {
            if (confirm("Vuoi migrare i dati delle disponibilità dal vecchio al nuovo formato? Questa operazione è necessaria solo se hai creato disponibilità con una versione precedente dell'applicazione.")) {
                this.disabled = true;
                this.style.opacity = "0.7";
                const originalButtonText = this.innerHTML;
                this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Migrazione in corso...';
                
                migrateOldDataToNewFormat()
                    .then(() => {
                        this.innerHTML = '<i class="fas fa-check"></i> Migrazione completata';
                        setTimeout(() => {
                            this.innerHTML = originalButtonText;
                            this.disabled = false;
                            this.style.opacity = "1";
                            location.reload(); // Ricarica la pagina per mostrare i dati migrati
                        }, 2000);
                    })
                    .catch(error => {
                        console.error("Errore nella migrazione:", error);
                        showToast("Si è verificato un errore durante la migrazione. Riprova più tardi.", true);
                        this.innerHTML = originalButtonText;
                        this.disabled = false;
                        this.style.opacity = "1";
                    });
            }
        });
        
        // Inserisci il pulsante all'inizio del footer
        footerArea.insertBefore(migrateButton, footerArea.firstChild);
    }
    
    if (dateInput) {
        if (!dateInput.value) {
             dateInput.value = formattedDate;
        }
        if (calendarGrid) {
            selectedDate = formattedDate;
        }
    }
    
    window.connectionWasOnline = navigator.onLine;
    loadAvailability();
    retryAttempts = 0;
});

setInterval(() => {
    if (!checkInternetConnection() && window.connectionWasOnline !== false) {
        showToast("Connessione Internet persa. Alcune funzioni potrebbero non funzionare correttamente.", true);
        window.connectionWasOnline = false;
    } else if (checkInternetConnection() && window.connectionWasOnline === false) {
        showToast("Connessione Internet ripristinata!");
        window.connectionWasOnline = true;
        loadAvailability();
    }
}, 5000);
