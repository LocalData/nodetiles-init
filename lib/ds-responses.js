'use strict';

var _ = require('lodash');
var projector = require('nodetiles-core').projector;

var metrics = require('./metrics/pipeline');
var Response = require('./models/Response');

var QUERY_LIMIT = 5000;

function resultToGeoJSON(item) {
  var feature = {
    type: 'Feature',
    // Properties are used for UTF grids
    properties: {},
    geometry: item.geometry
  };

  // Copy all the responses
  var entries = item.entries;
  if (entries) {
    feature.properties.responses = entries[entries.length - 1].responses;
  }

  // Add the geometries to the properties for use in the UTF grids
  // We need to do a deep copy here, otherwise we'll get the reprojected
  // geometries later.
  // TODO: if we're  generating PNGs, we don't need to copy geometries.
  // TODO: we should investigate ways of progressively drawing the shape in the
  // dashboard, so we don't need to send the geometry at all.
  feature.properties.geometry = _.cloneDeep(item.geometry);
  feature.properties.name = item.properties.humanReadableName;
  feature.properties.object_id = item.properties.object_id;

  return feature;
}

exports.create = function create(options) {
  var select = options.select;
  _.defaults(select, {
    entries: -1,
    'properties.centroid': -1,
    'properties.survey': -1,
    'entries.created': -1,
    'entries.files': -1,
    'entries.source.started': -1,
    'entries.source.finished': -1,
    'entries.source.type': -1,
    indexedGeometry: -1
  });
  var baseQuery = options.query;
  var projection = projector.util.cleanProjString(options.projection || 'EPSG:4326');

  var maxZoom = options.zoom || 17;

  function fetch(query, mapProjection, done) {
    var limit = QUERY_LIMIT;
    var result = [];

    var dbTimer = metrics.dbTimer();
    var procTimer = metrics.processingTimer();

    function getChunk(skip) {
      dbTimer.start();
      Response.find(query)
      .select(select)
      .lean()
      .limit(limit)
      .skip(skip)
      .exec(function (error, docs) {
        dbTimer.pause();
        if (error) { return done(error); }

        if (!docs) {
          docs = [];
        }

        var finished = (docs.length !== limit);

        if (!finished) {
          getChunk(skip + limit);
        }

        procTimer.start();

        var len = docs.length;
        var i;
        for (i = 0; i < len; i += 1) {
          docs[i] = resultToGeoJSON(docs[i]);
        }

        var fc = {
          type: 'FeatureCollection',
          features: docs
        };

        if (projection !== mapProjection) {
          fc = projector.project.FeatureCollection(projection, mapProjection, fc);
        }

        result = result.concat(fc.features);

        procTimer.pause();

        if (finished) {
          dbTimer.stop();
          procTimer.stop();
          done(null, result);
        }
      });
    }

    getChunk(0);
  }

  function getShapes(minX, minY, maxX, maxY, mapProjection, done) {
    var sw = [minX, minY];
    var ne = [maxX, maxY];

    // project request coordinates into data coordinates
    if (mapProjection !== projection) {
      sw = projector.project.Point(mapProjection, projection, sw);
      ne = projector.project.Point(mapProjection, projection, ne);
    }

    var query = _.clone(baseQuery);
    var bbox = [[sw[0], sw[1]], [ne[0],  ne[1]]];
    query[options.key] = { '$within': { '$box': bbox} };

    fetch(query, mapProjection, function (error, docs) {
      if (error) {
        console.log('Error fetching responses from the database');
        console.log(error);
        done(error);
        return;
      }

      var fc = {
        type: 'FeatureCollection',
        features: docs
      };

      done(null, fc);
    });


  }

  return {
    sourceName: options.name || 'localdata',
    getShapes: getShapes
  };
};