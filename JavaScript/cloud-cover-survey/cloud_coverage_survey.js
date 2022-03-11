// ================ cloud coverage algorithm part =============================
// TODO extent to Landsat Sentinel
var mod_col = ee.ImageCollection("MODIS/006/MOD09GA")//.filterDate(start,end)
// we use third-party color palette to draw 
var gena_palettes = require('users/gena/packages:palettes');

function get_modis_cloud_covering(image){
  var cloud = bitwiseExtract(image.select("state_1km"), 0, 1)
  cloud = cloud.where(cloud.neq(0),1)
  return cloud
}

function bitwiseExtract(input,frombit,tobit)
{
  if (tobit === undefined)
  tobit =frombit
  var masksize = ee.Number(1).add(tobit).subtract(frombit)
  var mask = ee.Number(1).leftShift(masksize).subtract(1)
  return input.rightShift(frombit).bitwiseAnd(mask)
}


function clear_map(){
  while (drawingTools.layers().length() > 0) {
    var layer = drawingTools.layers().get(0);
    drawingTools.layers().remove(layer);
  }
}

function make_colorbar_param(palette){
  return {
    bbox: [0, 0, 1, 0.1],
    dimensions: '100x10',
    format: 'png',
    min:0,
    max:1,
    palette: palette
  }
}

function apply(){


  var dates = get_date_range()
  
  var aoi = drawingTools.layers().get(0).getEeObject();
  print('the geometry you just drew:',aoi)
  
  drawingTools.setShape(null);
  
  var mapScale = Map.getScale();
  var scale = mapScale > 5000 ? mapScale * 2 : 5000;
  
  var col = mod_col.filterDate(dates.start, dates.end).filterBounds(aoi)
  print('the detail of the MODIS Collection:',col)
  
  col = col.map(get_modis_cloud_covering)
  
  var cloud_cover_days = col.sum()
  
  // clear_map()
  var date_range =dates.end.difference(dates.start, 'day')
  // var vis = {min:0, max:date_range.getInfo(), palette: 'navy,blue,aqua'}
  var vis = {min:0, max:date_range.getInfo(), palette: gena_palettes.colorbrewer.RdYlGn[8].reverse()}
  cloud_cover_days = cloud_cover_days.where(cloud_cover_days.gte(date))
  // color bar
  
  var corlorbar = ui.Thumbnail({
    image: ee.Image.pixelLonLat().select(0),
    params: make_colorbar_param(vis.palette),
    style: {stretch: 'horizontal', margin: '0px 8px', maxHeight: '24px'},
  })
  
  var legend_labels = ui.Panel({
     widgets: [
    ui.Label(vis.min, {margin: '4px 8px'}),
    ui.Label(
        ((vis.max-vis.min) / 2+vis.min),
        {margin: '4px 8px', textAlign: 'center', stretch: 'horizontal'}),
    ui.Label(vis.max, {margin: '4px 8px'})
  ],
  layout: ui.Panel.Layout.flow('horizontal')
  })
  
  var start_date_string = dates.start.format('YYYYMMDD').getInfo()
  var end_date_string = dates.end.format('YYYYMMDD').getInfo()
  
  var legendTitle = ui.Label({
  value: 'Cloud-free days from '+ start_date_string + ' to ' + end_date_string +  ' (days)',
  style: {fontWeight: 'bold'}
    
  });
  
  var legendPanel = ui.Panel([legendTitle, corlorbar, legend_labels]);
  
  
  if (added_colorbar == false){
    Map.add(legendPanel)
    added_colorbar=true
  } 
  
  Map.addLayer(cloud_cover_days.clip(aoi), vis)
  // print(drawingTools.layers())
  
  
}

function get_date_range(){
  var start_date = ee.Date(date_definition_panel.def_start_date.getValue().toString())
  var end_date = ee.Date(date_definition_panel.def_end_date.getValue().toString())
  var dates = {
    start:start_date,
    end:  end_date,
  }
  return dates
}


// ================ interactivation part =============================
var added_colorbar = false

var drawingTools = Map.drawingTools()

// close the original drawing buttons
drawingTools.setShown(false)


//Setup a while loop to clear all existing geometries 
//that have been added as imports from drawing tools 
//(from previously running the script)
while (drawingTools.layers().length() > 0) {
  var layer = drawingTools.layers().get(0);
  drawingTools.layers().remove(layer);
}

var dummyGeometry =
    ui.Map.GeometryLayer({geometries: null, name: 'geometry', color: '23cba7'});

drawingTools.layers().add(dummyGeometry);

function clearGeometry() {
  var layers = drawingTools.layers();
  layers.get(0).geometries().remove(layers.get(0).geometries().get(0));
}

function drawRectangle() {
  clearGeometry();
  drawingTools.setShape('rectangle');
  drawingTools.draw();
}

function drawPolygon() {
  clearGeometry();
  drawingTools.setShape('polygon');
  drawingTools.draw();
}

function drawPoint() {
  clearGeometry();
  drawingTools.setShape('point');
  drawingTools.draw();
}

var chartPanel = ui.Panel({
  style:
      {height: '235px', width: '600px', position: 'bottom-right', shown: false}
});


Map.add(chartPanel);


drawingTools.onDraw(ui.util.debounce(test, 500));
drawingTools.onEdit(ui.util.debounce(test, 500));


var _start_date ="2021-1-1"
var _end_date ="2021-1-23"

var symbol = {
  rectangle: '⬛',
  polygon: '🔺',
  point: '📍',
};


var date_definition_panel = {
    def_start_date: ui.Textbox({
      placeholder: 'start date',
      value: _start_date,
      style: {width: '200px'}
    }),
    def_end_date: ui.Textbox({
      placeholder: 'end date',
      value: _end_date,
      style: {width: '200px'}
    })
    
    
  }


var rules = {
  cloud_days : ui.Checkbox({
    label: "cloud free",
    value: true,
    onChange: test()
  })
}

var controlPanel = ui.Panel({
  widgets: [

    ui.Label('1. select the time range.'),
    date_definition_panel.def_start_date,
    date_definition_panel.def_end_date,
    
    ui.Label('2. define the rules.'),
    ui.Label('*Unfinished'),
    rules.cloud_days,
    
    ui.Label('3. Select a drawing mode.'),
    ui.Button({
      label: symbol.rectangle + ' Rectangle',
      onClick: drawRectangle,
      style: {stretch: 'horizontal'}
    }),
    ui.Button({
      label: symbol.polygon + ' Polygon',
      onClick: drawPolygon,
      style: {stretch: 'horizontal'}
    }),
    ui.Button({
      label: symbol.point + ' Point',
      onClick: drawPoint,
      style: {stretch: 'horizontal'}
    }),
    ui.Label('4. Draw a geometry.'),
    ui.Label('5. Wait for chart to render.'),
    ui.Label(
        '6. Repeat 1-3 or edit/move\ngeometry for a new chart.',
        {whiteSpace: 'pre'})
  ],
  style: {position: 'bottom-left'},
  layout: null,
});

controlPanel.add(ui.Button({
  label: "apply",
  onClick: apply,
  style: {stretch: 'horizontal'}
}))

Map.add(controlPanel);
