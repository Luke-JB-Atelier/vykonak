# Ověření počítadla

Jádro: `node --test tests/counter-engine.test.cjs`.

Zkušební přejezd: `node --test tests/counter-sweep.test.cjs`. Test ověřuje
potvrzení pozice z více pohledů, dočasně chybějící detekci, opakovanou značku,
simulovaný přepal, stín u spodku i v jeho dutině a zachování počtu při výpadku
zarovnání.

Přejezd používá oficiální sestavení [OpenCV.js 4.13.0](https://docs.opencv.org/4.13.0/opencv.js)
z adresáře `vendor`. Worker je načítá při prvním použití tohoto režimu.

Pro test kamery spusť místní HTTP server, zpřístupni balíček Playwright v Node
a nastav `COUNTER_BASE_URL` na adresu aplikace. Případně nastav `EDGE_PATH` na
prohlížeč Chromium/Edge. Potom spusť `node --test tests/counter-camera.test.cjs`.
Bez `COUNTER_BASE_URL` se test kamery přeskočí. Používá generovaný kamerový tok,
včetně uměle pomalého workeru; nepotřebuje skutečnou kameru ani její oprávnění.

## Co zaručují testy verze 9.23

- Výsledek a značky patří ke stejnému obrazu. Měření se neřadí do fronty.
- Změna počtu nečeká na medián sedmi starších výsledků.
- Kalibrace zastaví zobrazený obraz; volí se střed a okraj plastu, bez kontaktů.
- Barevná kalibrace pracuje s poměry RGB a okolním podkladem. Jasová hranice se
  přepočítává pro každý obraz při výrazném kontrastu vůči podkladu.
- Filtr odlišné velikosti používá skupinu podobných těl v aktuálním záběru.
  Při shodném počtu kandidátů pomůže zvolený vzor. Pevný rozměr v pixelech se
  nevynucuje, aby fungovala změna vzdálenosti i jediný izolovaný kus.
- Jednoduché modelové scény ověřují drobný kovový úlomek, dotýkající se těla,
  velkou světlou plochu, menší měřítko a ztmavení.
- Zavření panelu zastaví i kameru, jejíž inicializace skončila až po zavření.

## Praktické meze

Modelové testy neprokazují spolehlivé rozpoznání skutečných rotorků. Stále jde
o barevnou a geometrickou heuristiku, nikoli naučený model plastového dílu.
Kalibrace je volitelná, zkušební a může výsledek na některých podkladech zhoršit.
Posuvníky a původní ruční režim zůstávají dostupné; vypnutí zkušebního režimu
zruší vzor. Kalibrace se neukládá mezi otevřeními kamery.

Místní kontrola šesti uživatelem dodaných ukázek (v každé 18 skutečných kusů),
jedna předem vybraná kalibrace pro každou scénu, posuvníky 55/35:

| Scéna | Správně nalezené | Falešné značky | Chybějící |
| --- | ---: | ---: | ---: |
| Světlá látka | 15 | 1 | 3 |
| Tmavé čalounění, dekorace | 18 | 0 | 0 |
| Tmavé čalounění, díly | 18 | 0 | 0 |
| Tmavé čalounění, další bílé předměty | 18 | 6 | 0 |
| Dřevo, dotýkající se dvojice | 17 | 0 | 1 |
| Dřevo, řady a odlesk | 14 | 0 | 4 |

Nejde o reprezentativní datovou sadu ani test na telefonu. Pouhá shoda součtu
18 nestačí: hodnotí se i polohy značek. Původní zkušební režim bez kalibrace
zůstává beze změny; na ukázce s řadami měl lepší výsledek než kalibrace.
Soukromé podklady nejsou součástí repozitáře a neposílají se na žádnou službu.

Zatím nelze slíbit odmítnutí každého odlesku nebo cizího bílého předmětu.
Pro další zvyšování spolehlivosti je vhodné otestovat model naučený rozpoznávat
konkrétní plastová těla. Pouhé navyšování frekvence ani sytosti to nenahradí.
