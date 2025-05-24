// vDisponibilita.js – versione corretta 27 apr 2025

document.addEventListener('DOMContentLoaded', () => {
    /* ------------------------------------------------------------------
       RIFERIMENTI DOM
    ------------------------------------------------------------------ */
    const calendarGrid          = document.querySelector('.calendar-grid');
    const currentMonthElement   = document.getElementById('currentMonth');
    const prevMonthButton       = document.getElementById('prevMonth');
    const nextMonthButton       = document.getElementById('nextMonth');
    const timeSlotsContainer    = document.getElementById('timeSlots');
    const slotDateElement       = document.getElementById('slotDate');
    const bookingModal          = document.getElementById('bookingModal');
    const closeModalButton      = document.getElementById('closeModal');
    const cancelBookingButton   = document.getElementById('cancelBooking');
    const confirmBookingButton  = document.getElementById('confirmBooking');
    const logoutButton          = document.getElementById('logoutButton');
    const btnModificaDisponibilita  = document.getElementById('btnModificaDisponibilita');
    const btnGestionePrenotazioni   = document.getElementById('btnGestionePrenotazioni');
    const userNameElement       = document.getElementById('userName');

    /* ------------------------------------------------------------------
       VARIABILI DI STATO
    ------------------------------------------------------------------ */
    let currentDate     = new Date();
    let currentMonth    = currentDate.getMonth();
    let currentYear     = currentDate.getFullYear();
    let selectedDate    = null;
    let selectedSlot    = null;
    let isAdmin         = false;
    let currentUser     = null;
    const daysWithSlots = {};          // Popolato da loadMonthSlotData()

    /* ------------------------------------------------------------------
       INIZIALIZZAZIONE APP
    ------------------------------------------------------------------ */
    (function initApp () {
        if (!window.firebaseWrapper) {
            console.error('Firebase Wrapper mancante');
            showToast('Errore: Firebase non trovato', true);
            return;
        }
        firebaseWrapper.initializeFirebase();

        // Controllo di autenticazione
        firebase.auth().onAuthStateChanged(user => {
            if (!user) return window.location.href = 'index.html';

            currentUser = user;
            userNameElement.textContent = user.email || user.displayName || 'Utente';
            checkIfUserIsAdmin(user.uid);

            // 1. Carica slot del mese
            loadMonthSlotData().then(() => {
                // 2. Disegna il calendario solo dopo che daysWithSlots è pronto  // ★ FIX
                renderCalendar();
                // 3. Evidenzia i giorni con slot
                updateCalendarWithSlots();
            });
        });

        // Event listeners statici
        prevMonthButton .addEventListener('click', () => changeMonth(-1));
        nextMonthButton .addEventListener('click', () => changeMonth(+1));
        logoutButton    .addEventListener('click', handleLogout);
        btnModificaDisponibilita?.addEventListener('click', () => location.href = 'disponibilita.html');
        btnGestionePrenotazioni ?.addEventListener('click', () => location.href = 'prenotazioni_admin.html');

        // Modal
        closeModalButton   .addEventListener('click', closeBookingModal);
        cancelBookingButton.addEventListener('click', closeBookingModal);
        confirmBookingButton.addEventListener('click', handleBookingConfirmation);
    })();

    /* ------------------------------------------------------------------
       AUTH/ADMIN
    ------------------------------------------------------------------ */
    // Funzione per verificare se l'utente corrente è un amministratore
    function checkIfUserIsAdmin(uid) {
        try {
            const adminRef = firebaseWrapper.ref(`admin/${uid}`);
            firebaseWrapper.onValue(adminRef, (snapshot) => {
                isAdmin = snapshot.exists() && snapshot.val() === true;
                
                // Mostra o nascondi il pulsante di amministrazione in base al ruolo
                if (btnGestionePrenotazioni) {
                    btnGestionePrenotazioni.style.display = isAdmin ? "block" : "none";
                }
                
                // Aggiorna lo stato nell'assistente AI
                if (window.updateAIAssistantAdminStatus) {
                    window.updateAIAssistantAdminStatus(isAdmin);
                }
                
                console.log("Admin status:", isAdmin);
            });
        } catch (error) {
            console.error("Errore durante il controllo dello stato admin:", error);
            isAdmin = false;
        }
    }

    /* ------------------------------------------------------------------
       CALENDARIO
    ------------------------------------------------------------------ */
    const monthNames = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                        'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

    function renderCalendar () {
        // Header mese
        currentMonthElement.textContent = `${monthNames[currentMonth]} ${currentYear}`;

        // Pulisci giorni vecchi
        calendarGrid.querySelectorAll('.day').forEach(el => el.remove());

        const firstDayIndex   = (new Date(currentYear, currentMonth, 1).getDay() + 6) % 7; // lun-dom
        const daysInMonth     = new Date(currentYear, currentMonth + 1, 0).getDate();
        const prevMonthDays   = new Date(currentYear, currentMonth, 0).getDate();

        // Giorni vuoti iniziali
        for (let i = firstDayIndex; i > 0; i--)
            calendarGrid.appendChild(buildDay(prevMonthDays - i + 1, true));

        // Giorni del mese
        for (let i = 1; i <= daysInMonth; i++)
            calendarGrid.appendChild(buildDay(i, false));

        // Celle finali per completare la griglia
        const totalCells = Math.ceil((firstDayIndex + daysInMonth) / 7) * 7;
        for (let i = 1; i <= totalCells - (firstDayIndex + daysInMonth); i++)
            calendarGrid.appendChild(buildDay(i, true));
    }

    function buildDay (dayNum, isEmpty) {
        const div  = document.createElement('div');
        div.className = 'day' + (isEmpty ? ' empty' : '');
        div.textContent = dayNum;

        if (isEmpty) return div;

        const dateObj  = new Date(currentYear, currentMonth, dayNum);
        const dateKey  = formatDateKey(dateObj);

        // Oggi
        const today = new Date();
        if (today.toDateString() === dateObj.toDateString()) div.classList.add('today');

        // Slot
        if (daysWithSlots[dateKey]) div.classList.add('has-slots');

        // Click
        div.addEventListener('click', () => {
            document.querySelectorAll('.day.selected').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedDate = dateObj;
            loadDaySlotData(dateObj);
        });

        return div;
    }

    function updateCalendarWithSlots () {
        document.querySelectorAll('.day:not(.empty)').forEach(div => {
            const dateKey = formatDateKey(new Date(currentYear, currentMonth, +div.textContent));
            div.classList.toggle('has-slots', !!daysWithSlots[dateKey]);
        });
    }

    function changeMonth (delta) {
        currentMonth += delta;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
        if (currentMonth >11) { currentMonth =  0; currentYear++; }
        // Ricarica slot e ridisegna
        loadMonthSlotData().then(() => {
            renderCalendar();
            updateCalendarWithSlots();
            // Se selezione fuori mese resetta
            slotDateElement.textContent = 'Seleziona una data';
            timeSlotsContainer.innerHTML =
                '<div class="no-slots">Seleziona un giorno dal calendario per vedere le disponibilità</div>';
        });
    }

    /* ------------------------------------------------------------------
       CARICAMENTO SLOT – MESE
    ------------------------------------------------------------------ */
    function loadMonthSlotData () {
        const startDate = new Date(currentYear, currentMonth, 1);
        const endDate   = new Date(currentYear, currentMonth + 1, 0);

        Object.keys(daysWithSlots).forEach(k => delete daysWithSlots[k]); // reset

        return firebaseWrapper.ref('disponibilita').once('value').then(snap => {
            if (!snap.exists()) return;

            snap.forEach(dateSnap => {
                const dateKey = dateSnap.key;
                const slotDate = parseDate(dateKey);
                if (slotDate < startDate || slotDate > endDate) return;

                let hasActiveSlot = false;
                dateSnap.forEach(slotSnap => {
                    const d = slotSnap.val();
                    // ★ FIX – accetta slot senza isActive oppure con stringa "true"
                    const attivo = d && (d.isActive === undefined || d.isActive === true || d.isActive === 'true');
                    if (attivo) hasActiveSlot = true;
                });
                if (hasActiveSlot) daysWithSlots[dateKey] = true;
            });
        }).catch(err => {
            console.error('Errore loadMonthSlotData:', err);
            showToast('Errore nel caricamento delle disponibilità', true);
        });
    }

    /* ------------------------------------------------------------------
       CARICAMENTO SLOT – GIORNO
    ------------------------------------------------------------------ */
    function loadDaySlotData (dateObj) {
        const dateKey = formatDateKey(dateObj);
        slotDateElement.textContent = dateObj.toLocaleDateString('it-IT',
                                    {weekday:'long', day:'numeric', month:'long', year:'numeric'});

        timeSlotsContainer.innerHTML = '<div class="no-slots">Caricamento disponibilità…</div>';

        firebaseWrapper.ref(`disponibilita/${dateKey}`).once('value').then(snap => {
            timeSlotsContainer.innerHTML = '';
            if (!snap.exists()) return showNoSlotsMessage();

            const slots = [];
            snap.forEach(slotSnap => {
                const d = slotSnap.val();
                if (!d) return;
                d.id = slotSnap.key;
                // ★ FIX – stessa logica di cui sopra
                const attivo = d.isActive === undefined || d.isActive === true || d.isActive === 'true';
                if (attivo) slots.push(d);
            });

            slots.sort((a,b) => a.startTime.localeCompare(b.startTime));
            if (!slots.length) return showNoSlotsMessage();

            slots.forEach(s => timeSlotsContainer.appendChild(createSlotElement(s,dateKey)));
        }).catch(err => {
            console.error('Errore loadDaySlotData:', err);
            showToast('Errore nel caricamento delle disponibilità', true);
            showNoSlotsMessage();
        });
    }

    function createSlotElement (slot, dateKey) {
        const div = document.createElement('div');
        div.className = 'time-slot' + (slot.isBooked ? ' occupied' : '');

        div.innerHTML = `
            <div class="time-info">
                <div class="time-range">${slot.startTime} - ${slot.endTime}</div>
                <div class="slot-description">${slot.description || 'Nessuna descrizione'}</div>
            </div>
            ${slot.isBooked
                ? '<button class="booked-button" disabled>Già prenotato</button>'
                : '<button class="book-button">Prenota</button>'}
        `;

        if (!slot.isBooked) div.querySelector('.book-button').addEventListener('click', () => {
            selectedSlot = { id: slot.id, dateKey, startTime: slot.startTime, endTime: slot.endTime };
            openBookingModal();
        });

        return div;
    }

    function showNoSlotsMessage () {
        timeSlotsContainer.innerHTML =
            '<div class="no-slots"><i class="fas fa-calendar-times"></i><p>Nessuna disponibilità per questa data</p></div>';
    }

    /* ------------------------------------------------------------------
       MODAL PRENOTAZIONE
    ------------------------------------------------------------------ */
    function openBookingModal () {
        ['booking-name','booking-email','booking-phone','booking-notes']
            .forEach(id => document.getElementById(id).value = '');
        bookingModal.classList.add('open');
    }
    function closeBookingModal () {
        bookingModal.classList.remove('open');
        selectedSlot = null;
    }
    function handleBookingConfirmation () {
        const name  = document.getElementById('booking-name').value.trim();
        const email = document.getElementById('booking-email').value.trim();
        if (!name || !email) return showToast('Compila i campi obbligatori', true);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return showToast('Email non valida', true);

        const bookingData = {
            id          : null,
            name, email,
            phone       : document.getElementById('booking-phone').value.trim(),
            notes       : document.getElementById('booking-notes').value.trim(),
            userId      : currentUser.uid,
            userEmail   : currentUser.email,
            timestamp   : new Date().toISOString(),
            slotId      : selectedSlot.id,
            date        : selectedSlot.dateKey,
            startTime   : selectedSlot.startTime,
            endTime     : selectedSlot.endTime,
            status      : 'confirmed'
        };

        const bookingRef = firebaseWrapper.ref('prenotazioni').push();
        bookingData.id = bookingRef.key;

        bookingRef.set(bookingData).then(() =>
            firebaseWrapper.ref(`disponibilita/${bookingData.date}/${bookingData.slotId}`)
                .update({ isBooked:true, bookingId:bookingData.id })
        ).then(() => {
            showToast('Prenotazione confermata!');
            closeBookingModal();
            loadDaySlotData(selectedDate);
            
            // Notifica l'AI dell'avvenuta prenotazione
            if (window.aiAssistantNotifyBooking) {
                window.aiAssistantNotifyBooking(bookingData);
            }
        }).catch(err => {
            console.error('Errore prenotazione:', err);
            showToast('Errore durante la prenotazione', true);
        });
    }

    // Funzione globale per permettere all'AI di creare prenotazioni
    window.createBookingFromAI = async function(slotId, date, startTime, endTime, customerName, customerEmail, customerPhone = '', notes = '') {
        if (!currentUser) {
            throw new Error("Utente non autenticato");
        }
        
        // Trova lo slot
        const daySlots = await new Promise((resolve) => {
            firebaseWrapper.ref(`disponibilita/${date}`).once('value', (snapshot) => {
                resolve(snapshot.val() || {});
            });
        });
        
        if (!daySlots[slotId] || daySlots[slotId].isBooked) {
            throw new Error("Slot non disponibile");
        }
        
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

        const bookingRef = firebaseWrapper.ref('prenotazioni').push();
        bookingData.id = bookingRef.key;

        await bookingRef.set(bookingData);
        await firebaseWrapper.ref(`disponibilita/${date}/${slotId}`)
            .update({ isBooked: true, bookingId: bookingData.id });

        // Aggiorna l'interfaccia se siamo sulla stessa data
        if (selectedDate === date) {
            loadDaySlotData(selectedDate);
        }
        
        return bookingData;
    };

    /* ------------------------------------------------------------------
       LOGOUT
    ------------------------------------------------------------------ */
    function handleLogout () {
        firebase.auth().signOut().then(() => location.href = 'index.html')
            .catch(err => { console.error(err); showToast('Errore logout', true); });
    }

    /* ------------------------------------------------------------------
       UTILITIES
    ------------------------------------------------------------------ */
    // Funzione per mostrare notifiche toast
    function showToast (message, isError = false) {
        const toast = document.getElementById('toast');
        if (!toast) {
            console.error("Elemento toast non trovato");
            console.log(message);
            return;
        }
        
        const toastMessage = toast.querySelector('.toast-message');
        if (!toastMessage) {
            console.error("Elemento toast-message non trovato");
            console.log(message);
            return;
        }
        
        toastMessage.textContent = message;
        
        if (isError) {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }
        
        toast.classList.add('show');
        
        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
    function formatDateKey (d) { return d.toISOString().slice(0,10); }
    function parseDate (s)     { const [y,m,d] = s.split('-'); return new Date(+y,+m-1,+d); }
});