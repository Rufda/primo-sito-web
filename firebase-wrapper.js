/**
 * Firebase Wrapper - Un wrapper che uniforma l'accesso a Firebase
 * Supporta sia Firebase SDK modular che compat
 * 
 * Questo wrapper rileva automaticamente la versione di Firebase disponibile
 * e fornisce un'interfaccia comune per l'utilizzo delle sue funzionalità
 */

(function() {
    // Classe FirebaseWrapper
    class FirebaseWrapper {
        constructor() {
            this.app = null;
            this.auth = null;
            this.database = null;
            this.isInitialized = false;
            this.isModular = false;
        }

        /**
         * Inizializza Firebase con la configurazione fornita
         * Rileva automaticamente se utilizzare la versione compat o modular
         */
        initializeFirebase() {
            if (this.isInitialized) {
                console.log("Firebase è già inizializzato");
                return;
            }

            if (typeof firebaseConfig === 'undefined') {
                console.error("Errore: firebaseConfig non è definito. Assicurati che config.js sia caricato prima di firebase-wrapper.js.");
                this.showError("Errore di configurazione Firebase. Contatta l'amministratore.");
                return;
            }

            try {
                // Verifica se è disponibile Firebase compat
                if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
                    console.log("Usando Firebase compat");
                    this.app = firebase.initializeApp(firebaseConfig); // Usa firebaseConfig globale
                    this.auth = firebase.auth();
                    this.database = firebase.database();
                    this.isModular = false; // Assumendo che stiamo usando la versione compat
                    this.isInitialized = true;
                    console.log("Firebase compat inizializzato con successo");

                    // Dispatch event when ready
                    const event = new CustomEvent('firebase-ready', { detail: { wrapper: this } });
                    document.dispatchEvent(event);
                    console.log("Evento firebase-ready dispatchato.");

                } else {
                    console.error("Firebase SDK non è disponibile o initializeApp non è una funzione. Verifica che i file di Firebase SDK siano caricati correttamente prima di firebase-wrapper.js.");
                    throw new Error("Firebase SDK non disponibile");
                }
            } catch (error) {
                console.error("Errore durante l'inizializzazione di Firebase:", error.message);
                this.showError("Errore durante l'inizializzazione di Firebase. Riprova più tardi.");
                throw error;
            }
        }

        /**
         * Ottieni l'istanza del database
         * @returns {object} L'istanza del database
         */
        getDatabase() {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }
            return this.database;
        }

        /**
         * Crea un riferimento a un percorso nel database
         * @param {string} path - Il percorso nel database
         * @returns {object} Il riferimento al database
         */
        ref(path) {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }
            
            return this.database.ref(path);
        }

        /**
         * Aggiunge un listener per i cambiamenti dei dati
         * @param {object} reference - Il riferimento al database
         * @param {function} callback - La funzione di callback da chiamare quando i dati cambiano
         * @param {function} errorCallback - La funzione di callback per gli errori
         */
        onValue(reference, callback, errorCallback) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return;
            } else {
                // Versione compat
                reference.on('value', callback, errorCallback);
            }
        }

        /**
         * Rimuove un riferimento dal database
         * @param {object} reference - Il riferimento al database da rimuovere
         * @returns {Promise} Una promessa che si risolve quando l'operazione è completata
         */
        remove(reference) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return Promise.reject(new Error("Remove non supportato in modalità modular"));
            } else {
                // Versione compat
                return reference.remove();
            }
        }

        /**
         * Aggiunge dati al database
         * @param {object} reference - Il riferimento al database
         * @param {object} data - I dati da aggiungere
         * @returns {Promise} Una promessa che si risolve quando l'operazione è completata
         */
        push(reference, data) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return Promise.reject(new Error("Push non supportato in modalità modular"));
            } else {
                // Versione compat
                return reference.push(data);
            }
        }

        /**
         * Aggiorna i dati nel database
         * @param {object} reference - Il riferimento al database
         * @param {object} data - I dati da aggiornare
         * @returns {Promise} Una promessa che si risolve quando l'operazione è completata
         */
        update(reference, data) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return Promise.reject(new Error("Update non supportato in modalità modular"));
            } else {
                // Versione compat
                return reference.update(data);
            }
        }

        /**
         * Legge un valore una sola volta dal database
         * @param {object} reference - Il riferimento al database
         * @returns {Promise} Una promessa che si risolve con lo snapshot dei dati
         */
        get(reference) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return Promise.reject(new Error("Get non supportato in modalità modular"));
            } else {
                // Versione compat
                return reference.get(); // o reference.once('value')
            }
        }

        /**
         * Imposta i dati nel database (sovrascrive)
         * @param {object} reference - Il riferimento al database
         * @param {object} data - I dati da impostare
         * @returns {Promise} Una promessa che si risolve quando l'operazione è completata
         */
        set(reference, data) {
            if (this.isModular) {
                // Versione modular (non in uso al momento)
                return Promise.reject(new Error("Set non supportato in modalità modular"));
            } else {
                // Versione compat
                return reference.set(data);
            }
        }

        /**
         * Esegue l'autenticazione con email e password
         * @param {string} email - L'email dell'utente
         * @param {string} password - La password dell'utente
         * @returns {Promise} Una promessa che si risolve con l'utente autenticato
         */
        signInWithEmailAndPassword(email, password) {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }

            return this.auth.signInWithEmailAndPassword(email, password);
        }

        /**
         * Registra un nuovo utente con email e password
         * @param {string} email - L'email dell'utente
         * @param {string} password - La password dell'utente
         * @returns {Promise} Una promessa che si risolve con l'utente registrato
         */
        createUserWithEmailAndPassword(email, password) {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }

            return this.auth.createUserWithEmailAndPassword(email, password);
        }

        /**
         * Esegue il logout
         * @returns {Promise} Una promessa che si risolve quando il logout è completato
         */
        signOut() {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }

            return this.auth.signOut();
        }

        /**
         * Ottieni l'utente corrente
         * @returns {object|null} L'utente corrente o null se non c'è un utente autenticato
         */
        getCurrentUser() {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }

            return this.auth.currentUser;
        }

        /**
         * Aggiunge un listener per i cambiamenti dello stato di autenticazione
         * @param {function} callback - La funzione da chiamare quando lo stato cambia
         */
        onAuthStateChanged(callback) {
            if (!this.isInitialized) {
                this.initializeFirebase();
            }
            return this.auth.onAuthStateChanged(callback);
        }

        /**
         * Mostra un messaggio di errore
         * @param {string} message - Il messaggio di errore
         */
        showError(message) {
            console.error(message);
            if (typeof showToast === 'function') {
                showToast(message, true);
            } else {
                alert(message);
            }
        }
    }

    // Esporta l'istanza del wrapper come variabile globale
    window.firebaseWrapper = new FirebaseWrapper();
    console.log("FirebaseWrapper istanziato. Chiama initializeFirebase() per connetterti.");

    // Tentativo di inizializzazione automatica se firebase SDK è già caricato.
    // Questo è utile se firebase-wrapper.js è caricato dopo firebase SDK e config.js
    if (typeof firebase !== 'undefined' && typeof firebaseConfig !== 'undefined') {
        // Deferring initialization slightly to ensure config.js might have run
        setTimeout(() => {
            if (!window.firebaseWrapper.isInitialized) {
                console.log("Tentativo di inizializzazione automatica di Firebase da firebase-wrapper.js");
                window.firebaseWrapper.initializeFirebase();
            }
        }, 0);
    }
})();