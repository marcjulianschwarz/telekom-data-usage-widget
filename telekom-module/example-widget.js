// Import telekom-module
const telekom = importModule("telekom-module.js")

// Load the data
data = await telekom.getData()

async function createWidget(){
  // Create new ListWidget
  widget = new ListWidget()

  // Access data like this (more examples in readme file):
  usedVolume = data.usedVolume
  initialVolume = data.initialVolume
  
  widget.addText(usedVolume + " von " + initialVolume)
  
  return widget
}

Script.setWidget(await createWidget())
Script.complete()
