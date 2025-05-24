/**
 * Firebase Wrapper - Un wrapper che uniforma l'accesso a Firebase
 * Supporta sia Firebase SDK modular che compat
 * 
 * Questo wrapper rileva automaticamente la versione di Firebase disponibile
 * e fornisce un'interfaccia comune per l'utilizzo delle sue funzionalità
 */

(function() {
    // Configurazione Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyC6nZVPaWXtgjWOP8veInKk6Omkp5vEXbI",
        authDomain: "primo-sito-web1.firebaseapp.com",
        databaseURL: "https://primo-sito-web1-default-rtdb.firebaseio.com",
        projectId: "primo-sito-web1",
        storageBucket: "primo-sito-web1.firebasestorage.app",
        messagingSenderId: "939095326009",
        appId: "1:939095326009:web:9447f09ea845600ac7bce8"
    };

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

            try {
                // Verifica se è disponibile Firebase compat
                if (typeof firebase !== 'undefined') {
                    console.log("Usando Firebase compat");
                    this.app = firebase.initializeApp(firebaseConfig);
                    this.auth = firebase.auth();
                    this.database = firebase.database();
                    this.isModular = false;
                    this.isInitialized = true;
                    console.log("Firebase compat inizializzato con successo");

                    // Dispatch event when ready
                    const event = new Event('firebase-ready');
                    document.dispatchEvent(event);

                } else {
                    console.error("Firebase non è disponibile. Verifica che i file di Firebase siano caricati correttamente.");
                    throw new Error("Firebase non disponibile");
                }
            } catch (error) {
                console.error("Errore durante l'inizializzazione di Firebase:", error);
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
    console.log("FirebaseWrapper inizializzato e pronto per l'uso");
})();