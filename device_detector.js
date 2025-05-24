/**
 * Device Detector
 * Sistema avanzato per il rilevamento del tipo di dispositivo (mobile, tablet, desktop)
 * che utilizza multiple strategie invece di basarsi solo sulla larghezza dello schermo
 */
class DeviceDetector {
    constructor() {
        this._isMobileDevice = null;
        this._isTabletDevice = null;
        this._isMacOS = null;
        this._isSafari = null;
        
        // Esegui immediatamente il rilevamento per garantire disponibilità immediata
        this._detectDeviceType();
    }

    /**
     * Determina se il dispositivo è mobile basandosi su diversi fattori
     * @returns {boolean} true se il dispositivo è mobile
     */
    isMobile() {
        if (this._isMobileDevice === null) {
            this._detectDeviceType();
        }
        return this._isMobileDevice;
    }

    /**
     * Determina se il dispositivo è un tablet
     * @returns {boolean} true se il dispositivo è un tablet
     */
    isTablet() {
        if (this._isTabletDevice === null) {
            this._detectDeviceType();
        }
        return this._isTabletDevice;
    }

    /**
     * Determina se il dispositivo è un desktop
     * @returns {boolean} true se il dispositivo è un desktop
     */
    isDesktop() {
        return !this.isMobile() && !this.isTablet();
    }
    
    /**
     * Determina se il browser è Safari
     * @returns {boolean} true se il browser è Safari
     */
    isSafari() {
        if (this._isSafari === null) {
            const userAgent = navigator.userAgent.toLowerCase();
            this._isSafari = 
                /safari/.test(userAgent) && 
                !/chrome/.test(userAgent) && 
                !/chromium/.test(userAgent) &&
                !/edge/.test(userAgent) &&
                !/firefox/.test(userAgent);
        }
        return this._isSafari;
    }
    
    /**
     * Determina se il dispositivo è un Mac
     * @returns {boolean} true se il dispositivo è un Mac
     */
    isMacOS() {
        if (this._isMacOS === null) {
            const userAgent = navigator.userAgent.toLowerCase();
            
            // Metodo principale: cercare "Macintosh" in userAgent
            this._isMacOS = /macintosh|mac os x/i.test(userAgent);
            
            // Metodo di fallback per browser più vecchi
            if (!this._isMacOS && navigator.platform) {
                this._isMacOS = navigator.platform.toLowerCase().includes('mac');
            }
        }
        return this._isMacOS;
    }

    /**
     * Rileva il tipo di dispositivo analizzando una combinazione di fattori
     * @private
     */
    _detectDeviceType() {
        // Inizializza come non mobile e non tablet
        this._isMobileDevice = false;
        this._isTabletDevice = false;
        
        // Rileva in base all'user agent
        const userAgent = navigator.userAgent || navigator.vendor || window.opera;
        
        // Controlla prima se è macOS + Safari perché ha una gestione speciale
        if (this.isMacOS() && this.isSafari()) {
            console.log("Rilevato Safari su macOS");
            
            // Su Safari con macOS, forziamo sempre la versione desktop
            this._isMobileDevice = false;
            this._isTabletDevice = false;
            return;
        }
        
        // Regex per rilevare dispositivi mobili standard
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(userAgent) || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4))) {
            this._isMobileDevice = true;
        }

        // Rileva tablet in base all'user agent
        if (/(tablet|ipad|playbook|silk)|(android(?!.*mobile))/i.test(userAgent)) {
            this._isTabletDevice = true;
            this._isMobileDevice = false; // Se è un tablet, non è un telefono mobile
        }

        // Verifica se il dispositivo supporta funzionalità touch 
        // (i desktop moderni possono avere touch, quindi lo consideriamo solo come indicatore aggiuntivo)
        const hasTouchSupport = 'ontouchstart' in window || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
        
        // Tieni conto anche delle dimensioni per casi limite (larghezza minima per un tablet)
        const minTabletWidth = 600;
        const minDesktopWidth = 1024;
        
        // Controllo specifico per macOS (metodo migliorato)
        if (this.isMacOS() && window.innerWidth > minTabletWidth) {
            // Override: su macOS, è sicuramente un desktop
            this._isMobileDevice = false;
            this._isTabletDevice = false;
        }
        
        // Verifica se la larghezza indica un tablet ma non è già stato rilevato come tale
        if (!this._isTabletDevice && !this._isMobileDevice && window.innerWidth >= minTabletWidth && window.innerWidth < minDesktopWidth) {
            this._isTabletDevice = true;
        }
        
        // Debug info
        console.log(`DeviceDetector: isMobile=${this._isMobileDevice}, isTablet=${this._isTabletDevice}, isMacOS=${this.isMacOS()}, isSafari=${this.isSafari()}, innerWidth=${window.innerWidth}`);
    }

    /**
     * Reindirizza alla versione mobile o desktop in base al tipo di dispositivo
     * @param {string} mobilePage - URL della pagina mobile
     * @param {string} desktopPage - URL della pagina desktop
     */
    redirectToCorrectVersion(mobilePage, desktopPage) {
        const currentPage = window.location.pathname.split('/').pop();
        
        // Log per debug
        console.log(`Redirect check: current=${currentPage}, mobile=${mobilePage}, desktop=${desktopPage}`);
        console.log(`Device: mobile=${this.isMobile()}, tablet=${this.isTablet()}, desktop=${this.isDesktop()}`);
        
        // Forza sempre la versione desktop per Safari su macOS
        if (this.isMacOS() && this.isSafari()) {
            if (currentPage !== desktopPage) {
                console.log(`Forzatura versione desktop per Safari su macOS`);
                window.location.href = desktopPage;
            }
            return;
        }
        
        // Se siamo già sulla pagina giusta, non reindirizzare
        if ((this.isMobile() || this.isTablet()) && currentPage === mobilePage) {
            return;
        }
        
        if (this.isDesktop() && currentPage === desktopPage) {
            return;
        }
        
        // Reindirizza alla versione corretta
        if (this.isMobile() || this.isTablet()) {
            window.location.href = mobilePage;
        } else {
            window.location.href = desktopPage;
        }
    }
}

// Esporta l'istanza globale del detector
const deviceDetector = new DeviceDetector();

// Rendi visibile globalmente per il debug
window.deviceDetector = deviceDetector;