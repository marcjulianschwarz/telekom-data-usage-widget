# Telekom Datennutzung Widget (iOS 14)

## !!!
# Neue Versionen dieses Widgets gibt es ab sofort bei meinen <a href="https://github.com/marcjulianschwarz/scriptable-widgets">Scriptable Widgets</a>!
## !!!

### Funktionen:
- aktuell verfügbares Datenvolumen
- bereits verbrauchtes Datenvolumen mit entsprechender Färbung (grün, gelb, orange, rot) je nachdem wie viel bereits verbraucht wurde (+ Prozentanzeige)
- Datum, bis zu dem das aktuelle Datenvolumen noch verfügbar ist (+ Anzahl Tage und Studen bis zu diesem Datum)
- Widget öffnet bei Berührung automatisch die Telekom Website um noch mehr Infos zur Datennutzung anzuzeigen
- angepasstest Design für medium und kleine Widgets
- automatisches Synchronisieren über iCloud (Datenvolumen auch an anderen iCloud Geräten ablesbar)
- (auch lokale Speicherung der Daten möglich)

### Setup:
1. App <a href="https://scriptable.app/">Scriptable</a> herunterladen.
2. Das Telekom Datennutzung Widget <a href="https://github.com/marcjulianschwarz/tmobile-data-usage-widget/blob/main/telekom-data-usage.js">Skript</a> kopieren.
3. Scriptable App öffnen, neues Skript erstellen, zuvor kopiertes Skript einfügen.
4. Auf den Homescreen wechseln, Scriptable Widget hinzufügen.
5. In den Widget Einstellungen beim Punkt "Script" das eben erstellte Skript auswählen.
6. (Für die erste Verwendung des Widgets muss das WLAN **deaktiviert** sein und eine Verbindung mit dem Mobilfunknetz vorhanden sein.)

**Für lokale Speicherung:**
Damit die Daten nur lokal gespeichert werden, muss bei Schritt 5 im Feld "Parameter" der Bergriff "local" angegeben werden.
Nun sollte das Widget auch ohne iCloud Anmeldung funktionieren.


Für mehr Einstellungen muss das Skript geöffnet werden. In den ersten Zeilen befindet sich ein Abschnitt **"SETUP"**. Hier können weitere Veränderungen vorgenommen werden.

**Hintergrund-Einstellungen:**<br>
<img src = "https://github.com/marcjulianschwarz/telekom-data-usage-widget/blob/main/images/FEC3B5CC-60D1-43EC-B0BF-B871558EB802.jpeg" width=200px>
<br>

`IMAGE_BACKGROUND` kann die Werte `true` und `false` annehmen und bestimmt ob das Widget ein Bild als Hintergrund haben soll.<br>
`IMAGE_NAME` ist der Name der Bilddatei, die unter dem Ordner "telekom-widget" gespeichert sein muss.<br>
<br>
Für den Effekt eines leicht transparenten Widgets muss das entsprechende Hintergrundbild erst mit dem Skript <a href="https://github.com/mzeryck/Widget-Blur">"Widget-Blur"</a> von <a href="https://github.com/mzeryck">@mzeryck</a> erstellt werden.
Nach dem Befolgen der Anweisungen in dem Widget-Blur Skript muss das Bild nur noch im "telekom-widget" Ordner gespeichert werden und der Name der Datei im "SETUP" Bereich des Telekom-Widgets eingetragen werden.


`BACKGROUND_COLOR` ist ein Hex-Farbcode, der die Farbe des Hintergrunds angibt.<br>
<br>
Wenn `IMAGE_BACKGROUND` auf `false` gesetzt wird, verwendet das Skript automatisch die Farbe, die unter `BACKGROUND_COLOR` angegeben ist.


### Telekom Modul
Mithilfe des <a href="https://github.com/marcjulianschwarz/telekom-data-usage-widget/blob/main/telekom-module/telekom-module.js">Telekom Moduls</a> lassen sich die Telekom Daten ganz einfach auch in eigenen Anwendungen verwenden. Eine Anleitung dazu (für Scriptable) und mehr Informationen befinden sich <a href="https://github.com/marcjulianschwarz/telekom-data-usage-widget/tree/main/telekom-module">hier</a>. 

### Fragen?
Gerne beantworte ich alle Fragen und freue mich über Feedback, Anregungen und Ideen, die zur Verbesserung des Widgets beitragen können.
Meine Kontaktmöglichkeiten:
- Twitter <a href="https://twitter.com/marcjulian_DS">@marcjulian_DS</a>
- Email/Website <a href="https://www.marc-julian.de/">marc-julian.de</a>

### Bilder:

<div>
<img src = "https://github.com/marcjulianschwarz/telekom-data-usage-widget/blob/main/images/EB88EB09-C1A0-4144-8AC9-C7074B2DF5AB.jpeg" width=240px>
<img src = "https://github.com/marcjulianschwarz/tmobile-data-usage-widget/blob/main/images/IMG_0544.jpeg" width=240px>
<img src = "https://github.com/marcjulianschwarz/tmobile-data-usage-widget/blob/main/images/IMG_0545.jpeg" width=240px>
<img src = "https://github.com/marcjulianschwarz/telekom-data-usage-widget/blob/main/images/E10F0CF9-83A4-4628-8949-442AC0281524.jpeg" width=240px>  
</div>


### Zukünftige Funktionen:
- Option zur Darstellung des Verbrauchs als Diagramm (in medium und großem Widget)
- Benutzerdefinierte Hintergründe

#### Updates:
30.10.2020: 
- lokale Speicherung möglich
- verbessertes Design des Medium-Size Widgets.

31.10.2020: 
- Schriftgröße in kleinem Widget wurde vergrößert.
- Tage und Stunden bis zu dem Datum, an dem das aktuelle Datenvolumen noch verfügbar ist.

06.11.2020:
- Fehler bezüglich lokaler Speicherung wurden behoben.
- Es wird jetzt immer das richtige Datum angezeigt.
- Telekom-module ab sofort verfügbar.

07.11.2020
- Hintergrundfarbe/bild können jetzt als SETUP eingestellt werden.
- Falls ein Fehler auftritt wird dieser nun korrekt ausgegeben.

### Bekannte Probleme:
- Eingeschränkter Darkmode Support für SFSymbols (WLAN Zeichen)
- Widget funktioniert nur mit deutschen Telekom Verträgen
- Widget funktioniert nicht mit Telekom unlimited Verträgen (Telekom API liefert keine Daten)

