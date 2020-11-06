// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;

const apiURL = "https://pass.telekom.de/api/service/generic/v1/status";

let fm = FileManager.iCloud();
let dir = fm.joinPath(fm.documentsDirectory(), "telekom-widget")
let path = fm.joinPath(dir, "telekom-data.json");

if(!fm.fileExists(dir)){
  fm.createDirectory(dir)
}

let wifi = false

let df = new DateFormatter();
df.useShortDateStyle();

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
}

async function getFromFile(){
  data = await JSON.parse(fm.readString(path));
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


module.exports.getData = async function getData(){
  data = ""
  try{
    data = await getFromApi()
    saveData(data)
  }catch{
    wifi = true
    console.log("Couldnt fetch data from API. Maybe your Wifi is still turned on. Will try to read from file.")
  }

  if(!fm.fileExists(path)){
    console.log("File doesnt exist. Looks like your first init. Disable Wifi and try again.")
  }else{
    data = await getFromFile()
    data = await processData(data)
  }
  return data
}
