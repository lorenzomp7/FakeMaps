# Craft spec: interfaccia mappa (riferimento: Google Maps web)

Studio fatto il 24/11/2026 solo su ciò che è visibile nella pagina pubblica `google.com/maps/@...` (consentita da robots.txt), a 1024 px (desktop) e 375 px (telefono). Nessun codice sorgente letto. Da qui si riprendono **pattern di interfaccia**, non grafica: niente logo, icone, colori del marchio, testi o immagini di Google.

## Pattern osservati

### Desktop (≥ 768 px)
- **Mappa a tutto schermo** come sfondo; tutto il resto galleggia sopra.
- **Barra laterale stretta a sinistra** (~72 px): icone + etichetta piccola (Salvati, Recenti), voce in fondo isolata.
- **Barra di ricerca flottante** in alto a sinistra: ~392 × 48 px, angoli completamente arrotondati (raggio 24 px), ombra leggera, icona cerca + azione secondaria a destra.
- **Chip di filtro** in fila accanto alla ricerca (altezza 32–48 px), scorrevoli in orizzontale.
- **Pannello di dettaglio a sinistra** quando si seleziona un elemento: larghezza fissa ~408 px, altezza piena, si può comprimere con una linguetta sul bordo destro. Contenuto, dall'alto:
  1. immagine/anteprima
  2. titolo (22 px, peso normale) + riga di metadati
  3. schede (Panoramica / Recensioni / Info), alte 48 px
  4. **riga di azioni**: 5 pulsanti tondi con icona ed etichetta sotto, larghi 72 px ciascuno; il primo pieno (azione principale), gli altri contornati
  5. **lista di informazioni**: una riga per dato, icona a sinistra + testo
- **Controlli mappa in basso a destra**, raggruppati in una colonna stretta (~29 px): posizione, zoom + e − uniti in un unico blocco (angoli arrotondati solo in cima e in fondo).
- **Selettore livelli** in basso a sinistra: miniatura quadrata con etichetta.

### Telefono (375 px)
- Barra di ricerca a **tutta larghezza** (margini 8 px), alta 48 px, a pillola; menu a sinistra, avatar a destra.
- **Pannello dal basso (bottom sheet)** a tutta larghezza, angoli superiori arrotondati (10 px), con maniglia in alto; parte "socchiuso" lasciando vedere la mappa e si trascina verso l'alto.
- Azioni principali nel pannello come **cerchi da 48 px** con etichetta sotto.
- **Pulsante "la tua posizione"** a pillola che galleggia appena sopra il pannello.
- Il pannello di dettaglio del desktop diventa questo stesso bottom sheet.

### Misure da riusare
- Scala di spaziature a 8 px (8 / 16 / 24 / 48).
- Altezza minima dei controlli toccabili: 48 px su telefono.
- Ombre leggere e corte sugli elementi flottanti (2–4 px di sfocatura).

## Adattamento proposto per BoatRadar
| Google Maps | BoatRadar |
|---|---|
| Ricerca luoghi | Ricerca barca per nome / MMSI / porto |
| Chip categorie (Ristoranti, Hotel…) | Chip tipo di nave (Passeggeri, Cargo, Pesca, Diporto…) |
| Scheda luogo a sinistra / bottom sheet | Scheda barca: nome, bandiera, tipo, velocità, rotta, ultima posizione, destinazione |
| Azioni Indicazioni / Salva / Condividi | Segui sulla mappa / Salva / Mostra rotta / Condividi |
| Controlli zoom e posizione | Stessi controlli, raggruppati in basso a destra |
| Selettore livelli | Livelli: mappa / satellite / carta nautica (se disponibile) |

## Cosa NON riprendiamo
Logo e nome Google, icone proprietarie, il marker rosso, la palette e i font del marchio, testi, immagini. BoatRadar mantiene colori, font e icone propri (o set open source come Material Symbols).
