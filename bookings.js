// bookings.js - mostra le prenotazioni dell'utente corrente

document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('prenotazioniBody');

    if (!window.firebaseWrapper) {
        console.error('Firebase non inizializzato');
        return;
    }

    // Inizializza Firebase se necessario
    firebaseWrapper.initializeFirebase();

    firebaseWrapper.onAuthStateChanged(user => {
        if (!user) {
            window.location.href = 'index.html';
            return;
        }
        caricaPrenotazioni(user.uid);
    });

    function caricaPrenotazioni(uid) {
        const ref = firebaseWrapper.ref('prenotazioni');
        firebaseWrapper.onValue(ref, snapshot => {
            tbody.innerHTML = '';
            if (!snapshot.exists()) return;

            snapshot.forEach(child => {
                const data = child.val();
                if (!data || data.userId !== uid) return;

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${data.name || data.username || ''}</td>
                    <td>${formatDate(data.date)}</td>
                    <td>${data.startTime || ''} - ${data.endTime || ''}</td>
                    <td>${calcolaDurata(data.startTime, data.endTime)}</td>`;
                tbody.appendChild(tr);
            });
        }, err => {
            console.error('Errore caricamento prenotazioni:', err);
        });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '';
        const [y,m,d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    }

    function calcolaDurata(start, end) {
        if (!start || !end) return '';
        const [h1,m1] = start.split(':').map(Number);
        const [h2,m2] = end.split(':').map(Number);
        const durata = (h2*60+m2) - (h1*60+m1);
        return durata > 0 ? `${durata} min` : '';
    }
});
