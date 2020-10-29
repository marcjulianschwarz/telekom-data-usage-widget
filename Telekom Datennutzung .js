// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: purple; icon-glyph: magic;
const apiURL = "https://pass.telekom.de/api/service/generic/v1/status"

let fm = FileManager.iCloud()
let dir = fm.documentsDirectory()
let path = fm.joinPath(dir, "widget-telekom.json")

let df = new DateFormatter()
df.useShortDateStyle()

let thin_font = Font.regularRoundedSystemFont(10)
let bold_font = Font.heavyRoundedSystemFont(10)
let telekom_color = new Color("#ea0a8e")

let wifi = false


// HELPER CLASS 
class Telekom{
  constructor(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil, usedAt){
    this.name = name
    this.usedVolume = usedVolume
    this.inititalVolume = initialVolume
    this.remainingVolume = remainingVolume
    this.usedPercentage = usedPercentage
    this.validUntil = validUntil
    this.usedAt = usedAt
  }
}

// HELPER DARKMODE FUNCTION
async function isUsingDarkAppearance(){
  const wv = new WebView()
  let js = "(window.matchMedia && window.matchMedia('(prefers-color-scheme:dark)').matches)"
  let r = await wv.evaluateJavaScript(js)
  return r
}

let darkmode = await isUsingDarkAppearance()


async function getFromApi(){

    data = ''
    let request = new Request(apiURL)
    request.headers = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 13_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1"
    }
    
  data = await request.loadJSON()
  
  data.usedAt = Date.now()

  fm.writeString(path, JSON.stringify(data))
    
    
    return data
}

function getFromFile(){
  data = JSON.parse(fm.readString(path))
  return data  
}



async function getData(){


  try{
    data_api = await getFromApi()
  }catch{
    wifi = true
    data_api = await getFromFile()
  }
  
  
  name = data_api.passName
  usedVolumeNum = data_api.usedVolume / 1024 / 1024 / 1024
  initialVolumeNum = data_api.initialVolume / 1024 / 1024 / 1024
  usedVolume = String(Math.round((usedVolumeNum + Number.EPSILON) * 100) /100).replace('.', ',') + ' GB'
  initialVolume = String(Math.round((initialVolumeNum + Number.EPSILON) * 100) / 100).replace('.', ',') + ' GB'
  
  
  
  remainingVolumeNum = (data_api.initialVolume - data_api.usedVolume) / 1024 / 1024 / 1024
  remainingVolume = String(Math.round((remainingVolumeNum + Number.EPSILON) * 100) / 100) + ' GB'
  remainingVolume = remainingVolume.replace('.', ',')
  
  
  usedPercentage = data_api.usedPercentage
  
  date = data_api.usedAt + data_api.remainingSeconds*1000
  validDate = new Date(date)
  validUntil = df.string(validDate)
  
  telekom = new Telekom(name, usedVolume, initialVolume, remainingVolume, usedPercentage, validUntil)
  
   
  return telekom

}



async function createWidget(data){

  
  widget = new ListWidget()
  
  widget.url = "https://pass.telekom.de"
  
  
  header_stack = widget.addStack()
  title = header_stack.addText(data.name)
  title.textColor = telekom_color
  
  
  if (wifi){
      
    header_stack.addSpacer()
    
    let symbol = SFSymbol.named('wifi.exclamationmark').image
    symbol_image = header_stack.addImage(symbol)
    symbol_image.imageSize = new Size(20, 20)
    if (darkmode){
      console.log("dark")
      symbol_image.tintColor = new Color("#ffffff")
    }else{
      console.log("light")
      symbol_image.tintColor = new Color("#000000")
   }
  }
  
  
  widget.addSpacer()
  
  available_txt = widget.addText(data.remainingVolume + ' von ' + data.inititalVolume + ' noch verfügbar.')
  
  widget.addSpacer()
  
  used_txt = widget.addText(data.usedVolume + ' (' + data.usedPercentage + '%) verbraucht.')
  
  widget.addSpacer()
  
  footer = widget.addText('Gültig bis: ' + data.validUntil)
  
  title.font = bold_font
  available_txt.font = thin_font
  used_txt.font = thin_font
  footer.font = thin_font
  
  if(data.usedPercentage >= 75){
    used_txt.textColor = Color.red()
  }else if(data.usedPercentage >= 50 && data.usedPercentage < 75){
    used_txt.textColor = Color.orange()
  } else if(data.usedPercentage >= 25 && data.usedPercentage < 50){
    used_txt.textColor = Color.yellow()
  }else{
    used_txt.textColor = Color.green()
  }
  
  widget.addSpacer()
  

  
  return widget
  

}


widget = new ListWidget()
info = widget.addText('Schalte zur ersten Einrichtung das WLAN aus und starte das Script erneut.')
info.font = Font.systemFont(13)


try {
  data = await getData()
  widget = await createWidget(data)
}catch {
  console.log('First init not working or error with fetching data')
}



Script.setWidget(widget)
widget.presentSmall()  
Script.complete()


// By marc julian schwarz