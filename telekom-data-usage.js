// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;


//########## SETUP ###########

let IMAGE_BACKGROUND = true
let IMAGE_NAME = "image.jpeg"

let BACKGROUND_COLOR = "#333333"


//########## END OF SETUP ##########

const apiURL = "https://pass.telekom.de/api/service/generic/v1/status";
parameter = await args.widgetParameter;

let fm = FileManager.iCloud();
if(parameter == "local"){
  fm = FileManager.local();
}else if(parameter == "icloud"){
  fm = FileManager.iCloud();
}

let dir = fm.joinPath(fm.documentsDirectory(), "telekom-widget")
let path = fm.joinPath(dir, "telekom-data.json");

if(!fm.fileExists(dir)){
  fm.createDirectory(dir)
}

let wifi = false

let df = new DateFormatter();
df.useShortDateStyle();

let widgetSize = config.widgetFamily;

// FONTS USED BY THE WIDGET
let thin_font = Font.regularRoundedSystemFont(13);
let small_font = Font.regularRoundedSystemFont(11);
let bold_font = Font.heavyRoundedSystemFont(13);
let title_font = Font.heavyRoundedSystemFont(11)

if(widgetSize == "medium"){
  thin_font = Font.regularRoundedSystemFont(17);
  small_font = Font.regularRoundedSystemFont(17);
  bold_font = Font.heavyRoundedSystemFont(19);
  title_font = Font.heavyRoundedSystemFont(19)

}

let telekom_color = new Color("#ea0a8e");

// HELPER CLASS 
class Telekom{
  constructor(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil, usedAt){
   	this.name = name;
    this.usedVolume = usedVolume;
    this.initialVolume = initialVolume;
    this.remainingVolume = remainingVolume;
    this.usedPercentage = usedPercentage;
    this.validUntil = validUntil;
    this.usedAt = usedAt;
  }
}

// HELPER FUNCTION TO CALCULATE DAYS AND HOURS FOR VALIDUNTIL
function getDaysHours(data){
  now = new Date(Date.now())
  hours_total = (data.validUntil - now) / 1000 / 60 / 60
  hours = hours_total%24
  days = (hours_total - hours) / 24
  return days + "d " + Math.round(hours) + "h"
}

async function getFromApi(){
    let request = new Request(apiURL);
    request.headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"
    };
    data = await request.loadJSON();
    return data;
}

async function saveData(data){
  data.savedDate = Date.now();
  fm.writeString(path, JSON.stringify(data));
  console.log("Saved new data")
}

async function getFromFile(){
  data = await JSON.parse(fm.readString(path));
  console.log("Fetching data from file was successful")
  return data
}

async function processData(data){
  
  var name = data.passName;
  var usedVolumeNum = data.usedVolume / 1024 / 1024 / 1024;
  var initialVolumeNum = data.initialVolume / 1024 / 1024 / 1024;
  
  var usedVolume = String(Math.round((usedVolumeNum + Number.EPSILON) * 100) /100).replace('.', ',') + ' GB';
  var initialVolume = String(Math.round((initialVolumeNum + Number.EPSILON) * 100) / 100).replace('.', ',') + ' GB';
  
  var remainingVolumeNum = (data.initialVolume - data.usedVolume) / 1024 / 1024 / 1024;
  var remainingVolume = String(Math.round((remainingVolumeNum + Number.EPSILON) * 100) / 100) + ' GB';
  remainingVolume = remainingVolume.replace('.', ',');
  
  var usedPercentage = data.usedPercentage;
  var date = data.savedDate + data.remainingSeconds*1000 - 60*1000;
  var validUntil = new Date(date);

  var telekom = new Telekom(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil);
  
  return telekom;
}



async function createWidget(data){

  var widget = new ListWidget();
  
  var header_stack = widget.addStack();
  var title = header_stack.addText(data.name);
  title.textColor = telekom_color;
  
  // WIFI Symbol
  if (wifi){
    header_stack.addSpacer();
    let symbol = SFSymbol.named('wifi.exclamationmark').image;
    var symbol_image = header_stack.addImage(symbol);
    symbol_image.imageSize = new Size(17, 17);
  }
  
  widget.addSpacer();
  
  if(widgetSize == "medium"){
    available_txt = widget.addText(data.remainingVolume + ' von ' + data.initialVolume + ' noch verfügbar.');
  }else{
    available_txt = widget.addText(data.remainingVolume + ' von ' + data.initialVolume);
  }
  
  widget.addSpacer(5)
  
  var used_txt = widget.addText(data.usedVolume + ' (' + data.usedPercentage + '%) verbraucht.');
  
  widget.addSpacer();
  
  var footer = widget.addText('Bis: ' + df.string(data.validUntil).toLocaleString() + ' (' + getDaysHours(data) + ')');
  
  
  // ASSIGNING FONTS
  title.font = title_font;
  available_txt.font = thin_font;
  used_txt.font = bold_font;
  footer.font = small_font;
  
  // COLORING BASED ON DATA PERCENTAGE
  if(data.usedPercentage >= 75){
    used_txt.textColor = Color.red();
  }else if(data.usedPercentage >= 50 && data.usedPercentage < 75){
    used_txt.textColor = Color.orange();
  } else if(data.usedPercentage >= 25 && data.usedPercentage < 50){
    used_txt.textColor = Color.yellow();
  }else{
    used_txt.textColor = Color.green();  
  }
  
  
  // BACKGROUND 
  if(IMAGE_BACKGROUND){
    image = await fm.readImage(fm.joinPath(dir, IMAGE_NAME))
    widget.backgroundImage = image
  }else{
    widget.backgroundColor = new Color(BACKGROUND_COLOR)
  }
 
  
  return widget;
}

function createFirstWidget(){
  w = new ListWidget()
  w.addText("Wlan für die erste Einrichtung ausschalten.")
  return w
}


try{
  data = await getFromApi()
  saveData(data)
}catch{
  wifi = true
  console.log("Couldnt fetch data from API. Wifi still on? Trying to read from file.")
}

if(!fm.fileExists(path)){
  console.log("File doesnt exist. Looks like your first init.")
  widget = await createFirstWidget()
  Script.setWidget(widget)
}else{
  data = await getFromFile()
  processedData = await processData(data)
  widget = await createWidget(processedData)
  widget.presentSmall()
  Script.setWidget(widget)
}

Script.complete()
