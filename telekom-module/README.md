# Telekom Modul

### Funktionen:
- bereits formatierte Daten von der Telekom API abrufen
- automatische Zwischenspeicherung der Daten (Zugriff auch ohne Verbindung zum mobilen Netz)
- Synchronisierung über iCloud

### Anleitung (Scriptable):
1. Skript "telekom-module.js" kopieren und in Scriptable App einfügen
2. Skript von "Untitled Script" zu "telekom-module.js" umbennen
3. In der eigenen Anwendung das Modul mit `const telekom = importModule("telekom-module.js")` importieren
4. An geeigneter Stelle können die Daten mit `let data = await telekom.getData()` abgerufen werden

Die Daten liegen in folgender Form vor:

`telekom.name` -> Name des Vertrags / "Ihr Datenvolumen", wenn kein Vertrag Name geliefert wird.<br>
`telekom.usedVolume` -> Verbrauchtes Datenvolumen in GB.<br>
`telekom.initialVolume` -> Volles Datenvolumen des Vertrags.<br>
`telekom.remainingVolume` -> Übriges Datenvolumen.<br>
`telekom.usedPercentage` -> Verbrauchtes Datenvolumen in Prozent.<br>
`telekom.validUntil` -> Datum, bis zu dem das aktuelle Datenvolumen gültig ist.<br>

Alle Daten außer "usedPercentage" (Int) sind String Objekte.

In der Datei <a href="https://github.com/marcjulianschwarz/telekom-data-usage-widget/blob/main/telekom-module/example-widget.js">Example Widget</a> befindet sich eine mögliche Implementierung des Moduls in ein Widget.

### Fragen?
Gerne beantworte ich alle Fragen und freue mich über Feedback, Anregungen und Ideen, die zur Verbesserung des Widgets beitragen können.
Meine Kontaktmöglichkeiten:
- Twitter <a href="https://twitter.com/marcjulian_DS">@marcjulian_DS</a>
- Email/Website <a href="https://www.marc-julian.de/">marc-julian.de</a>

### Bekannte Probleme:
- Funktioniert nur mit deutschen Telekom Verträgen
- Unlimited Verträge funktionieren nicht
