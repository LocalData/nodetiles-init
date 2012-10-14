// Basic configuration
var PORT = process.env.PORT || process.argv[2] || 3000;
var DEBUG = true;

// Script
var path = require('path'),
    express = require('express'),
    app = express();
    
var Map = require('nodetiles');
// var GeoJsonSource = require('./datasources/GeoJson'); // TODO: expose this


app.use(express.compress());
app.use(express.static(__dirname + '/public'));

// just use one map for everything
var map = new Map();
var tilejson = require(__dirname + '/tile');

// map.addData(function() { return layers });
// map.addData(function(x1, y1, x2, y2, projection, callback) { callback(null, layers); });
//map.addData(new GeoJsonSource({path: __dirname + '/geodata/planning_neighborhoods.json'}));
// map.addData(new GeoJsonSource({path: __dirname + '/geodata/sf_shore.json'}));
// map.addData(new GeoJsonSource({path: __dirname + '/geodata/sf_parks.json'}));
// map.addData(new GeoJsonSource({path: __dirname + '/geodata/sf_streets.json'}));
// map.addStyle(require('./sf_styles'));

// views
app.get('/', function(req, res) {
  res.sendfile(__dirname + '/public/index.html');
});

// tile/grid rendering routes
// app.get('/tiles/:zoom/:col/:row', tile);
// app.get('/utfgrids/:zoom/:col/:row', utfgrid);

app.get('/tile.:format', function(req, res) {
  // attribution
  tilejson.attribution = 'Awesomed by <a href=\"http://github.com/codeforamerica/nodetiles\">Nodetiles</a> — ' + tilejson.attribution;
  
  if (req.params.format === 'json' || req.params.format === 'jsonp' ) {
    res.jsonp(tilejson);
  }
  else {
    req.next();
  }
});

// simple default utility server
// app.get('/tiles/:zoom/:col/:row', TileServer.getTile);
app.get('/tiles/:zoom/:col/:row.png', function tile(req, res) {
  // TODO: clean this up since it's halfway to Express
  // TODO: handle no extension and non-png extensions
  // verify arguments
  var tileCoordinate = [req.params.zoom, req.params.col, req.params.row];
  if (!tileCoordinate || tileCoordinate.length != 3) {
    console.error(req.url, 'not a coordinate, match =', tileCoordinate);
    res.send(404, req.url + 'not a coordinate, match =' + tileCoordinate);
    return;
  }
  
  console.log('Requested tile: ' + tileCoordinate.join('/'));
  
  tileCoordinate = tileCoordinate.map(Number);
  
  // turn tile coordinates into lat/longs
  // TODO: custom TileMap class or tools for this
  var scale = Math.pow(2, tileCoordinate[0]);
  var minX = 256 * tileCoordinate[1] / scale;
  var minY = 256 * tileCoordinate[2] / scale;
  var maxX = minX + 256 / scale;
  var maxY = minY + 256 / scale;
  
  map.render(minX, minY, maxX, maxY, 256, 256, function(error, canvas) {
    var stream = canvas.createPNGStream();
    stream.pipe(res);
  });
});

// app.get('/utfgrids/:zoom/:col/:row', utfgrid);
app.get('/utfgrids/:zoom/:col/:row.:format?', function utfgrid(req, res) {
  // TODO: clean this up since it's halfway to Express
  // TODO: handle no extension and non-png extensions
  // verify arguments
  var tileCoordinate = [req.params.zoom, req.params.col, req.params.row];
  if (!tileCoordinate || tileCoordinate.length != 3) {
      console.error(req.url, 'not a coordinate, match =', tileCoordinate);
      res.send(404, req.url + 'not a coordinate, match =' + tileCoordinate);
      return;
  }
  
  console.log('Requested grid: ' + tileCoordinate.join('/'));
  
  tileCoordinate = tileCoordinate.map(Number);
  var respondWithImage = req.params.format === 'png';
  var renderHandler;
  
  if (respondWithImage) {
    renderHandler = function(err, canvas) {
      var stream = canvas.createPNGStream();
      stream.pipe(res);
    };
  }
  else {
    renderHandler = function(err, grid) {
      res.jsonp(grid);
    };
  }
  // tileRenderer.renderGrid(tileCoordinate[0], tileCoordinate[1], tileCoordinate[2], layers, renderHandler, respondWithImage);
  
  // turn tile coordinates into lat/longs
  // TODO: custom TileMap class or tools for this
  var scale = Math.pow(2, tileCoordinate[0] - 2);
  var minX = 64 * tileCoordinate[1] / scale;
  var minY = 64 * tileCoordinate[2] / scale;
  var maxX = minX + 64 / scale;
  var maxY = minY + 64 / scale;
  
  map.renderGrid(minX, minY, maxX, maxY, 64, 64, respondWithImage, renderHandler);
});

app.listen(PORT);
console.log("Express server listening on port %d in %s mode", PORT, app.settings.env);