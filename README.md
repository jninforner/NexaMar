# TraçaMar

TraçaMar és l’aplicació que fa servir el restaurant La Barca de Ca l’Ardet per seguir el peix des de la compra fins a la venda. S’obre al navegador i es pot afegir a la pantalla d’inici de l’iPhone o de l’iPad com una aplicació web progressiva (PWA).

La versió del codi en aquest repositori és la **7.9**. L’aplicació del restaurant és a [TraçaMar a GitHub Pages](https://jninforner.github.io/control-de-peixos/).

## Què pots fer amb TraçaMar

- **Registrar compres i partides.** Introdueix l’espècie, la preparació, els pesos, la quantitat i els costos. En una partida «A talls», tria si comptes talls o racions. La quantitat determina l’estoc, el cost per tall o ració i les etiquetes. També pots importar un albarà en JPG, PNG, WebP o PDF. Revisa les línies detectades, inclosos els cefalòpodes, i fes servir «Dona d’alta al catàleg» per afegir-hi espècies o articles nous.
- **Calcular la minva i els preus.** L’aplicació calcula la diferència entre el pes brut i el net, el cost per exemplar i un preu de venda orientatiu. Quan falta el pes net, pot suggerir-ne un a partir de partides anteriors.
- **Consultar l’estoc i registrar vendes.** Els exemplars s’agrupen per partida. Pots desplegar-la per veure els peixos disponibles i indicar quin has venut.
- **Imprimir etiquetes.** L’aplicació genera un PDF amb una etiqueta per exemplar de les partides seleccionades. Està pensat per a fulls A4 APLI 01272 de 24 etiquetes, de 70 × 35 mm. Pots començar en qualsevol posició del full i ajustar el marge superior i la separació entre files. L’etiqueta d’inventari mostra el cost real del peix. Des de Partides també pots imprimir el nombre d’etiquetes resum que necessitis, amb la data, el pes, la minva i els costos de la partida.

## Descarregar el projecte al Mac

1. Obre **Terminal**. Pots trobar-la amb Spotlight (⌘ + espai).
2. Comprova que tens Git i Python 3:

   ```bash
   git --version
   python3 --version
   ```

   Si macOS t’ofereix instal·lar les eines de línia d’ordres en comprovar Git, accepta la instal·lació. Si `python3` continua sense estar disponible, instal·la Python 3 des del [web oficial de Python](https://www.python.org/downloads/macos/) i torna a obrir Terminal.
3. Copia el repositori a la carpeta Documents:

   ```bash
   cd ~/Documents
   git clone --branch develop https://github.com/jninforner/control-de-peixos.git
   cd control-de-peixos
   ```

   Si ja tens una còpia al Mac, obre la carpeta que ja existeix amb `cd`. Amb `git fetch origin` i `git switch develop` pots baixar la informació de GitHub i passar a la branca de desenvolupament.

## Engegar i aturar TraçaMar

Cada vegada que vulguis engegar-lo, executa aquestes comandes des de Terminal. Si vas desar el projecte en un altre lloc, adapta la primera línia.

```bash
cd ~/Documents/control-de-peixos
python3 run dev
```

Obre [http://localhost:8000/](http://localhost:8000/) a Safari. Deixa la finestra de Terminal oberta mentre facis servir la còpia local. Per aturar el servidor, torna a Terminal i prem **Control + C**.

**De moment, fes servir la còpia local només per comprovar que apareix la pantalla d’entrada.** El codi actual apunta a la mateixa base de dades que fa servir el restaurant. Si hi entres amb un compte del restaurant, els canvis que facis des del Mac poden afectar l’inventari real. Les proves amb dades fictícies es podran fer quan la còpia local tingui una base de dades pròpia.

Si el port 8000 està ocupat, executa `python3 run dev --port 8001` i obre [http://localhost:8001/](http://localhost:8001/). Obre sempre l’adreça del servidor des del navegador. Els components que necessita l’aplicació es carreguen correctament quan la pàgina se serveix per HTTP.

## Com funciona per dins

| Fitxer | Què hi ha |
| --- | --- |
| `index.html` | La pantalla principal, els estils i el codi de compres, estoc, vendes i etiquetes. |
| `manifest.webmanifest` | El nom i les icones que veu el dispositiu quan hi afegeixes l’aplicació. |
| `run` | La comanda per engegar TraçaMar en local amb Python. |
| `sw.js` | El component que desa la pàgina i alguns fitxers al navegador perquè es puguin tornar a obrir sense connexió. |
| `icon.png` i `icon-512.png` | Les icones de TraçaMar. |

Python serveix els fitxers directament. El projecte no té cap pas de compilació ni paquets per instal·lar. Firebase gestiona l’inici de sessió amb correu i contrasenya i desa l’inventari a Firestore, al document `inventari/dades` del projecte `control-de-peixos`. El navegador necessita connexió per carregar el component de Firebase la primera vegada. Obrir la pàgina sense connexió i sincronitzar l’inventari són dues coses diferents.

Quan demanes que s’interpreti un albarà, TraçaMar envia la imatge o el PDF al Worker de Cloudflare `tracamar-ia`, que analitza el fitxer amb OpenAI. Aquesta funció necessita connexió i una sessió iniciada. Les dades d’una còpia antiga a HTML Viewer no es migren automàticament. Si encara la tens, conserva-la i exporta’n les dades.

## Treballar amb el repositori

Amb cada canvi de l’aplicació, incrementa la versió seguint aquesta seqüència: 6.6 → 6.7 → 6.8 → 6.9 → 7.1 → 7.2 → … → 7.9 → 8.1. Quan el segon número arriba a 9, suma 1 al primer i torna a començar per 1. Actualitza la versió visible sota el nom de TraçaMar a la capçalera i a la pantalla d’entrada, totes dues a `index.html`. Actualitza també la versió d’aquest document i la clau de la memòria cau de `sw.js`.

La còpia del Mac permet preparar canvis abans de publicar-los. El flux acordat és treballar a `develop`, provar els canvis en local amb dades fictícies i esperar el vistiplau abans de fer un *commit* (desar els canvis a l’historial) o un *push* (pujar-los a GitHub). La branca `main` està reservada a producció. Incorporar-hi els canvis i publicar a GitHub Pages requereix autorització expressa.
