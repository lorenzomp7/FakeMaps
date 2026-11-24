# FakeMaps

Mappa web con un'interfaccia **ispirata** a Google Maps, costruita da zero con dati e software open source.

## 🗺️ [Apri la mappa → lorenzomp7.github.io/FakeMaps](https://lorenzomp7.github.io/FakeMaps/)

Funziona nel browser, da computer e da telefono, senza installare nulla e senza account.

> ⚠️ **Progetto personale, non ufficiale e senza scopo di lucro.**
> FakeMaps è un esercizio di sviluppo fatto per studio e uso personale.
> Non è affiliato, approvato o sponsorizzato da Google LLC.
> **Nessuna riga di codice di Google Maps è stata copiata.** Vedi [Avviso legale](#avviso-legale).

## Cosa fa
- Mappa vettoriale a tutto schermo con tre stili (Predefinita, Chiara, Minimal), etichette in italiano
- Ricerca con suggerimenti mentre scrivi
- Filtri rapidi per categoria (Ristoranti, Hotel, Musei, Farmacie…) con «Cerca in questa zona»
- Scheda del luogo: indirizzo, orari, sito, telefono, accessibilità, tutti i tag OSM nella scheda «Informazioni»
- Azioni: Indicazioni, Salva, Nelle vicinanze, Condividi, Copia coordinate, Suggerisci una modifica (su OpenStreetMap)
- Indicazioni stradali in auto, a piedi e in bici, con percorsi alternativi e passaggi
- Tasto destro (o pressione lunga su telefono) per inserire un pin
- La tua posizione, zoom, scala
- Salvati e Recenti (solo nel tuo browser), link condivisibili
- Su telefono: pannello che sale dal basso e si trascina; su desktop: colonna laterale comprimibile

## Avviso legale

**Ispirazione, non copia.** L'interfaccia di FakeMaps richiama quella di Google Maps nella disposizione degli elementi
(barra di ricerca, filtri, pannello laterale, controlli della mappa). Per ottenerla è stato usato un metodo *clean room*:

- è stato osservato **solo ciò che chiunque vede** aprendo la pagina pubblica di Google Maps in un browser:
  posizione e dimensioni degli elementi, comportamento dei pannelli;
- **non** è stato letto, scaricato, decompilato o copiato il codice sorgente (HTML, CSS, JavaScript) di Google Maps;
- **non** sono state intercettate o usate API di Google;
- **tutto il codice di questo repository è stato scritto da zero.**

Le osservazioni fatte sono documentate in [`.craft/google-maps/spec.md`](.craft/google-maps/spec.md).

**Cosa non viene usato di Google.** Nessun marchio, nome di prodotto, logo, icona, marker, font proprietario (Google Sans),
immagine, testo, dato cartografico, risultato di ricerca o servizio di Google. Le icone sono Material Symbols e il font è Roboto,
entrambi rilasciati con licenze open source (vedi sotto). Mappe, ricerca e percorsi vengono da OpenStreetMap e servizi collegati.

**Marchi.** «Google» e «Google Maps» sono marchi di Google LLC. Sono citati qui solo per indicare la fonte d'ispirazione
dell'interfaccia, senza alcun legame con Google.

**Scopo.** Progetto personale, a scopo di studio e sperimentazione, senza fini commerciali, senza pubblicità e senza raccolta di dati.
Non è pensato per sostituire servizi di navigazione: i percorsi sono indicativi, verifica sempre la segnaletica.

**Segnalazioni.** Se ritieni che qualcosa in questo repository violi un tuo diritto, apri una
[issue](https://github.com/lorenzomp7/FakeMaps/issues): il contenuto verrà verificato e, se necessario, rimosso.

## Servizi usati (gratuiti, senza chiave)
| Funzione | Servizio | Regole d'uso |
|---|---|---|
| Tile della mappa | [OpenFreeMap](https://openfreemap.org) (OpenMapTiles) | attribuzione OpenStreetMap obbligatoria |
| Ricerca | [Photon](https://photon.komoot.io) di komoot | uso moderato |
| Dettagli e categorie | [Nominatim](https://nominatim.openstreetmap.org) | max 1 richiesta al secondo, mai per l'autocompletamento |
| Categorie (riserva) | [Overpass API](https://overpass-api.de) | uso moderato, spesso sovraccarico |
| Percorsi | [OSRM di FOSSGIS](https://routing.openstreetmap.de) | uso moderato |

Sono servizi pubblici e condivisi, adatti a un uso personale. Per molti utenti servirebbero istanze proprie o fornitori a pagamento.

## Avvio in locale
```bash
npm install
npm run build:assets   # copia MapLibre, font e icone in vendor/ e assets/
npm run serve          # http://localhost:4173
```
È un sito statico. Ogni push su `main` lo pubblica su GitHub Pages tramite `.github/workflows/pages.yml`.

## Crediti e licenze
- Dati © [collaboratori di OpenStreetMap](https://www.openstreetmap.org/copyright), ODbL
- [MapLibre GL JS](https://maplibre.org), BSD-3-Clause (`vendor/maplibre/LICENSE.txt`)
- Font Roboto, SIL Open Font License 1.1 (`assets/fonts/LICENSE-Roboto.txt`)
- Icone Material Symbols, Apache 2.0 (`assets/LICENSE-MaterialSymbols.txt`)
