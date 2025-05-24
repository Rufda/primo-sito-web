// Firebase App Inizializzatore
// Questo file si occupa di inizializzare Firebase e di esportare le funzioni necessarie

document.addEventListener('DOMContentLoaded', () => {
    console.error('Firebase non è stato caricato. Verifica che i tag script siano presenti nell\'HTML.');
});

// Evento DOM ready
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM completamente caricato");
});

window.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.getElementById('data');
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const defaultPlaceholder = `${dd}-${mm}-${yyyy}`;
  dateInput.placeholder = defaultPlaceholder;
  dateInput.addEventListener('change', function(){
    this.placeholder = (this.valu !== "") ? "" : defaultPlaceholder;
  });

  // Script per i campi orari
  const timeInputs = [document.getElementById('orarioInizio'), document.getElementById('orarioFine')];
  timeInputs.forEach(input => {
    const defaultPlaceholder = input.getAttribute('placeholder');
    input.addEventListener('change', function(){
      this.placeholder = (this.value !== "") ? "" : defaultPlaceholder;
    });
  });
});
