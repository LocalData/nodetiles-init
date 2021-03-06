'use strict';

/*
 * New Relic metrics for the render pipeline
 */

var agent = require('./agent');
var settings = require('../settings');

var componentName = 'tileserver pipeline:' + settings.name;
var lastPollTime = Date.now();

var metrics = {};

function makeMetric() {
  return {
    min: Number.POSITIVE_INFINITY,
    max: Number.NEGATIVE_INFINITY,
    total: 0,
    count: 0,
    sum_of_squares: 0
  };
}

function makeLatencyMetric(name) {
  var metric = makeMetric();
  metrics[name] = metric;

  return function start() {
    var t0 = Date.now();
    return function stop() {
      var t = Date.now() - t0;
      metric.min = Math.min(t, metric.min);
      metric.max = Math.max(t, metric.max);
      metric.total += t;
      metric.count += 1;
      metric.sum_of_squares += t * t;
    };
  };
}

function makePausableMetric(name) {
  var metric = makeMetric();
  metrics[name] = metric;

  return function () {
    var t0;
    var t = 0;
    return {
      stop: function stop() {
        if (t0 !== -1) {
          t += Date.now() - t0;
        }
        metric.min = Math.min(t, metric.min);
        metric.max = Math.max(t, metric.max);
        metric.total += t;
        metric.count += 1;
        metric.sum_of_squares += t * t;
      },
      pause: function pause() {
        t += Date.now() - t0;
        t0 = -1;
      },
      start: function start() {
        t0 = Date.now();
      }
    };
  };
}

// Metrics
//
// Render latency
exports.renderTimer = makeLatencyMetric('Component/Pipeline/Render/PNG[ms|render]');
exports.gridTimer = makeLatencyMetric('Component/Pipeline/Render/UTFGrid[ms|render]');
exports.datasourceTimer = makeLatencyMetric('Component/Pipeline/Datasource[ms|render]');
exports.dbTimer = makePausableMetric('Component/Pipeline/Database[ms|render]');
exports.processingTimer = makePausableMetric('Component/Pipeline/DataProcessing[ms|render]');

// Code for reporting metrics to the agent
//

exports.render = function render(options) {
  var data = {
    guid: options.guidPrefix + '.pipeline',
    name: componentName,
    duration: 0,
    metrics: {}
  };

  data.duration = (Date.now() - lastPollTime)/1000;
  lastPollTime = Date.now();

  Object.keys(metrics).forEach(function (name) {
    var metric = metrics[name];
    if (metric.count > 0) {
      data.metrics[name] = {
        min: metric.min,
        max: metric.max,
        total: metric.total,
        count: metric.count,
        sum_of_squares: metric.sum_of_squares
      };

      agent.logMetric(name, metric);
    }

    // Reset the internal stats
    metric.min = Number.POSITIVE_INFINITY;
    metric.max = Number.NEGATIVE_INFINITY;
    metric.total = 0;
    metric.count = 0;
    metric.sum_of_squares = 0;
  });

  return data;
};

exports.success = function success() {
};
