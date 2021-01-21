# Telekom Datennutzung Widget (iOS 14)

### Funktionen:
- aktuell verfügbares Datenvolumen
- bereits verbrauchtes Datenvolumen mit entsprechender Färbung (grün, gelb, orange, rot) je nachdem wie viel bereits verbraucht wurde (+ Prozentanzeige)
- Datum, bis zu dem das aktuelle Datenvolumen noch verfügbar ist (+ Anzahl Tage und Studen bis zu diesem Datum)
- Widget öffnet bei Berührung automatisch die Telekom Website um noch mehr Infos zur Datennutzung anzuzeigen
- angepasstest Design für medium und kleine Widgets
- "Daten Becher", der den aktuellen Stand des Datenverbrauchs anhand der Füllhöhe anzeigt
- automatisches Synchronisieren über iCloud (Datenvolumen auch an anderen iCloud Geräten ablesbar)
- (auch lokale Speicherung der Daten möglich)

### Setup:
1. App <a href="https://scriptable.app/">Scriptable</a> herunterladen.
2. Das Telekom Datennutzung Widget <a href="https://github.com/marcjulianschwarz/tmobile-data-usage-widget/blob/main/telekom-data-usage.js">Skript</a> kopieren.
3. Scriptable App öffnen, neues Skript erstellen, zuvor kopiertes Skript einfügen.
4. Auf den Homescreen wechseln, Scriptable Widget hinzufügen.
5. In den Widget Einstellungen beim Punkt "Script" das eben erstellte Skript auswählen.
6. (Für die erste Verwendung des Widgets muss das WLAN **deaktiviert** sein und eine Verbindung mit dem Mobilfunknetz vorhanden sein.)

### Parameter
Parameter können nach Schritt 5 angegeben werden.<br><br>

- "**local**"   -> Daten werden lokal gespeichert
- "**icloud**"  -> Daten werden über iCloud mit allen anderen Geräten synchronisiert
- "**visual**"  -> kann beim kleinen Widget verwendet werden um den "Daten Becher" anzuzeigen.

Es könenn auch mehrere Parameter durch ein Komma getrennt angegeben werden.

### Mehr Einstellungen
Für mehr Einstellungen muss das Skript geöffnet werden. In den ersten Zeilen befindet sich ein Abschnitt **"SETUP"**. Hier können weitere Veränderungen vorgenommen werden (zum Beispiel Hintergrundfarbe ändern).

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
- Angepasstes Large Widget

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

07.11.2020:
- Hintergrundfarbe/bild können jetzt als SETUP eingestellt werden.
- Falls ein Fehler auftritt wird dieser nun korrekt ausgegeben.

20.01.2021:
- Darkmode funktioniert jetzt auch für SFSymbols
- Angepasstes Medium Widget mit einer neuen Anzeige für den Verbrauch

### Bekannte Probleme:
- Widget funktioniert nur mit deutschen Telekom Verträgen
- Widget funktioniert nicht mit Telekom unlimited Verträgen (Telekom API liefert keine Daten)

