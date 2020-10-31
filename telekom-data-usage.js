// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;


const apiURL = "https://pass.telekom.de/api/service/generic/v1/status";
let fm = FileManager.iCloud();
let p = await args.widgetParameter
let widgetSize = config.widgetFamily

if(p == 'local'){
  fm = FileManager.local();
}

let dir = fm.documentsDirectory();
let path = fm.joinPath(dir, "widget-telekom.json");

let df = new DateFormatter();
df.useShortDateStyle();

let wifi = false;
let spacer_size = 4


// FONTS USED BY THE WIDGET
let thin_font = Font.regularRoundedSystemFont(13);
let small_font = Font.regularRoundedSystemFont(11);
let bold_font = Font.heavyRoundedSystemFont(13);
let title_font = Font.heavyRoundedSystemFont(11)

if(widgetSize == "medium"){
  thin_font = Font.regularRoundedSystemFont(19);
  small_font = Font.regularRoundedSystemFont(17);
  bold_font = Font.heavyRoundedSystemFont(19);
  title_font = Font.heavyRoundedSystemFont(19)

  spacer_size = null
}

// SPECIAL COLORS
let telekom_color = new Color("#ea0a8e");

// HELPER CLASS 
class Telekom{
  constructor(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil, usedAt){
   	this.name = name;
    this.usedVolume = usedVolume;
    this.inititalVolume = initialVolume;
    this.remainingVolume = remainingVolume;
    this.usedPercentage = usedPercentage;
    this.validUntil = validUntil;
    this.usedAt = usedAt;
  }
}

// HELPER DARKMODE FUNCTION (DARKMODE IN WIDGETS STILL NOT WORKING PERFECTLY)
async function isUsingDarkAppearance(){
  const wv = new WebView();
  let js = "(window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches)";
  let r = await wv.evaluateJavaScript(js);
  return r;
}

let darkmode = await isUsingDarkAppearance();

// HELPER FUNCTION TO CALCULATE DAYS AND HOURS FOR VALIDUNTIL
function getDaysHours(data){
  now = new Date(Date.now())
  hours_total = (data.validUntil - now) / 1000 / 60 / 60
  hours = hours_total%24
  days = (hours_total - hours) / 24
  return days + "d " + Math.round(hours) + "h"
}


// FETCHING DATE FROM TELEKOM API
async function getFromApi(){
    data = '';
    let request = new Request(apiURL);

    request.headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"
    };
  data = await request.loadJSON();
  
  data.usedAt = Date.now(); // Storing date to calculate validUntil from the remaining seconds
  fm.writeString(path, JSON.stringify(data));
  return data;
}



async function getData(){
  try{
    data_api = await getFromApi();
  }catch{
    wifi = true;
    data_api = await JSON.parse(fm.readString(path));
  }
  
  // PREPROCESSING DATA
  var name = data_api.passName;
  var usedVolumeNum = data_api.usedVolume / 1024 / 1024 / 1024;
  var initialVolumeNum = data_api.initialVolume / 1024 / 1024 / 1024;
  
  var usedVolume = String(Math.round((usedVolumeNum + Number.EPSILON) * 100) /100).replace('.', ',') + ' GB';
  var initialVolume = String(Math.round((initialVolumeNum + Number.EPSILON) * 100) / 100).replace('.', ',') + ' GB';
  
  var remainingVolumeNum = (data_api.initialVolume - data_api.usedVolume) / 1024 / 1024 / 1024;
  var remainingVolume = String(Math.round((remainingVolumeNum + Number.EPSILON) * 100) / 100) + ' GB';
  remainingVolume = remainingVolume.replace('.', ',');
  
  var usedPercentage = data_api.usedPercentage;
  var date = data_api.usedAt + data_api.remainingSeconds*1000;
  var validUntil = new Date(date);

  var telekom = new Telekom(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil);
  
  return telekom;

}

async function createWidget(data){

  var widget = new ListWidget();
  widget.url = "https://pass.telekom.de";
    
  var header_stack = widget.addStack();
  var title = header_stack.addText(data.name);
  title.textColor = telekom_color;
  
  if (wifi){
    header_stack.addSpacer();

    let symbol = SFSymbol.named('wifi.exclamationmark').image;
    var symbol_image = header_stack.addImage(symbol);
    symbol_image.imageSize = new Size(17, 17);
    
    if (darkmode){
      symbol_image.tintColor = new Color("#ffffff");
    }else{
      symbol_image.tintColor = new Color("#000000");
    }
  }
  
  widget.addSpacer(spacer_size);
  if (widgetSize == "medium"){
     available_txt = widget.addText(data.remainingVolume + ' von ' + data.inititalVolume + ' noch verfügbar.');
    
  }else{
    available_txt = widget.addText(data.remainingVolume + ' von ' + data.inititalVolume + '\nnoch verfügbar.');
  }
  
  widget.addSpacer(spacer_size);
  var used_txt = widget.addText(data.usedVolume + ' (' + data.usedPercentage + '%) verbraucht.');
  
  widget.addSpacer(spacer_size);
  
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
  
  return widget;
}

// TEMPORARY WIDGET FOR FIRST TIME USERS
var widget = new ListWidget();
var info = widget.addText('Schalte zur ersten Einrichtung das WLAN aus und starte das Script erneut.');
info.font = Font.systemFont(13);

try {
  var data = await getData();
  var widget = await createWidget(data);
}catch {
  console.log('First init not working or error while fetching data');
}

Script.setWidget(widget);
widget.presentMedium();
Script.complete();
