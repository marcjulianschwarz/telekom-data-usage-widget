// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;


//########## SETUP ###########

const BACKGROUND_COLOR = Color.dynamic(new Color("#ffffff"), new Color("#161618"));
const TELEKOM_COLOR = new Color("#ea0a8e");
const TEXT_COLOR = Color.dynamic(new Color("000000"), new Color("#ffffff"));

//########## END OF SETUP ##########

const apiURL = "https://pass.telekom.de/api/service/generic/v1/status";
const imgURL = "https://raw.githubusercontent.com/marcjulianschwarz/telekom-data-usage-widget/main/symbols/"

let parameters = await args.widgetParameter;

if(parameters == null){
  parameters = "icloud, visual"
}

let widgetSize = config.widgetFamily;

let fm = FileManager.iCloud();
if(parameters.includes("local")){
  fm = FileManager.local();
}else if(parameters.includes("icloud")){
  fm = FileManager.iCloud();
}


let dir = fm.joinPath(fm.documentsDirectory(), "telekom-widget");
let path = fm.joinPath(dir, "telekom-data.json");
if(!fm.fileExists(dir)){
  fm.createDirectory(dir);
}

let wifi = false;
let df = new DateFormatter();
df.useShortDateStyle();

// FONTS USED BY THE WIDGET
let thin_font = Font.regularRoundedSystemFont(13);
let small_font = Font.regularRoundedSystemFont(11);
let bold_font = Font.heavyRoundedSystemFont(13);
let title_font = Font.heavyRoundedSystemFont(11);

if(widgetSize == "medium"){
  thin_font = Font.regularRoundedSystemFont(15);
  small_font = Font.regularRoundedSystemFont(13);
  bold_font = Font.heavyRoundedSystemFont(15);
  title_font = Font.heavyRoundedSystemFont(17);
}


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

// Get all data and process
async function getFromApi(){
    let request = new Request(apiURL);
    request.headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"
    };
    data = await request.loadJSON();
    return data;
}

async function saveImages(){
  console.log("loading and saving images")
  var imgs = ["full", "half", "low", "empty", "almost"]
  for(img of imgs){
    let img_path = fm.joinPath(dir, img + ".png");
    if(!fm.fileExists(img_path)){
      console.log("Loading image: " + img + ".png")
      let request = new Request(imgURL + img + ".png");
      console.log(request);
      image = await request.loadImage();
      fm.writeImage(img_path, image);
    }
  }
}

async function getImageFor(name){
  let img_path = fm.joinPath(dir, name + ".png");
  await fm.downloadFileFromiCloud(img_path);
  img = await fm.readImage(img_path);
  return img;
}

async function saveData(data){
  data.savedDate = Date.now();
  fm.writeString(path, JSON.stringify(data));
  console.log("Saved new data to file");
}

async function getFromFile(){
  await fm.downloadFileFromiCloud(path);
  data = await JSON.parse(fm.readString(path));
  console.log("Fetching data from file was successful");
  return data;
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

// Create all widgets
function createFirstWidget(){
  first = new ListWidget()
  first.addText("Wlan für die erste Einrichtung ausschalten und Widget erneut erstellen.")
  return first
}

async function createErrorWidget(err){
  err_widget = new ListWidget();
  err_widget.addText(err);
  return err_widget;
}

async function createSmallVisualWidget(data){

  var small_visual_widget = new ListWidget();
  var img = await getImageFor("empty");

  if(data.usedPercentage >= 75 && data.usedPercentage <= 95){
    img = await getImageFor("low");
  }else if(data.usedPercentage >= 50 && data.usedPercentage < 75){
    img = await getImageFor("half");
  } else if(data.usedPercentage >= 25 && data.usedPercentage < 50){
    img = await getImageFor("almost");
  }else if(data.usedPercentage < 25){
    img = await getImageFor("full");  
  }

  var widget_image = small_visual_widget.addImage(img);
  widget_image.centerAlignImage();

  small_visual_widget.backgroundColor = BACKGROUND_COLOR;

  return small_visual_widget;

}

async function createSmallWidget(data){

  var widget = new ListWidget();
  var header_stack = widget.addStack();
  var title = header_stack.addText(data.name);
  
  // WIFI Symbol
  if (wifi){
    header_stack.addSpacer();
    let symbol_image = SFSymbol.named('wifi.exclamationmark').image;
    var symbol = header_stack.addImage(symbol_image);
    symbol.imageSize = new Size(17, 17);
    symbol.tintColor = TEXT_COLOR;
  }
  
  widget.addSpacer();
  var used_txt = widget.addText('Benutzt: ' + data.usedVolume + ' (' + data.usedPercentage + '%).');
  widget.addSpacer(5)
  var available_txt = widget.addText(data.remainingVolume + ' von ' + data.initialVolume);
  widget.addSpacer();
  var footer = widget.addText('Bis: ' + df.string(data.validUntil).toLocaleString() + ' (' + getDaysHours(data) + ')');
  
  // ASSIGNING FONTS and COLORS
  title.font = title_font;
  available_txt.font = bold_font;
  used_txt.font = thin_font;
  footer.font = small_font;

  title.textColor = TELEKOM_COLOR;
  used_txt.textColor = TEXT_COLOR;
  footer.textColor = TEXT_COLOR;

  // COLORING BASED ON DATA PERCENTAGE
  if(data.usedPercentage >= 75){
    available_txt.textColor = Color.red();
  }else if(data.usedPercentage >= 50 && data.usedPercentage < 75){
    available_txt.textColor = Color.orange();
  } else if(data.usedPercentage >= 25 && data.usedPercentage < 50){
    available_txt.textColor = Color.yellow();
  }else{
    available_txt.textColor = Color.green();  
  }
  
  widget.backgroundColor = BACKGROUND_COLOR;
 
  return widget;
}

async function createMediumWidget(data){

  medium_widget = new ListWidget();
  var body_stack = medium_widget.addStack();

  var info_stack = body_stack.addStack();
  body_stack.addSpacer();
  var visual_stack = body_stack.addStack();

  // Stack Layout
  body_stack.layoutHorizontally();
  info_stack.layoutVertically();
  visual_stack.layoutVertically();


  var title = info_stack.addText(data.name);
  info_stack.addSpacer();
  var used_txt = info_stack.addText('Benutzt: ' + data.usedVolume + ' (' + data.usedPercentage + '%).');
  info_stack.addSpacer()
  var available_txt = info_stack.addText(data.remainingVolume + ' von ' + data.initialVolume);
  info_stack.addSpacer();
  var footer = info_stack.addText('Bis: ' + df.string(data.validUntil).toLocaleString() + ' (' + getDaysHours(data) + ')');

  img = await getImageFor("empty");

  // COLORING BASED ON DATA PERCENTAGE
  if(data.usedPercentage >= 75 && data.usedPercentage <= 95){
    available_txt.textColor = Color.red();
    img = await getImageFor("low");
  }else if(data.usedPercentage >= 50 && data.usedPercentage < 75){
    available_txt.textColor = Color.orange();
    img = await getImageFor("half");
  } else if(data.usedPercentage >= 25 && data.usedPercentage < 50){
    available_txt.textColor = Color.yellow();
    img = await getImageFor("almost");
  }else if(data.usedPercentage < 25){
    available_txt.textColor = Color.green();
    img = await getImageFor("full");  
  }else if(data.usedPercentage > 95){
    available_txt.textColor = Color.red();
  }

  visual_stack.addSpacer()
  visual_stack.addImage(img)

  // ASSIGNING FONTS and COLORS
  title.font = title_font;
  available_txt.font = bold_font;
  used_txt.font = thin_font;
  footer.font = small_font;

  title.textColor = TELEKOM_COLOR;
  used_txt.textColor = TEXT_COLOR;
  footer.textColor = TEXT_COLOR;

  medium_widget.backgroundColor = BACKGROUND_COLOR;

  return medium_widget;
}

async function createLargeWidget(data){

  large_widget = new ListWidget();

  large_widget.backgroundColor = BACKGROUND_COLOR;

  return large_widget;
}



// Runtime:
await saveImages()


try{
  data = await getFromApi()
  saveData(data)
}catch{
  wifi = true
  console.log("Couldnt fetch data from API. Wifi still on? Trying to read from file.")
}

if(!fm.fileExists(path)){
  console.log("File doesnt exist. Looks like your first init.")
  first = await createFirstWidget()
  Script.setWidget(first)
}else{
  data = await getFromFile()
  processedData = await processData(data)

  widget = createErrorWidget("Widget couldnt be created");

  switch(widgetSize){
    case "small": 
      if(parameters.includes("visual")){
        widget = await createSmallVisualWidget(processedData);
      }else{
        widget = await createSmallWidget(processedData);
      }
    break;
    case "medium": widget = await createMediumWidget(processedData);
    break;
    case "large": widget = await createLargeWidget(processedData);
    break;
    default: widget = await createSmallWidget(processedData);
  }
  
  widget.presentSmall()
  
  Script.setWidget(widget)
}


Script.complete()
