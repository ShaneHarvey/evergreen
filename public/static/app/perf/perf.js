const numericFilter = function (x) {
  return !_.isNaN(parseInt(x))
};

// since we are using an older version of _.js that does not have this function
const findIndex = function (list, predicate) {
  for (let i = 0; i < list.length; i++) {
    if (predicate(list[i])) {
      return i
    }
  }
};

mciModule.controller('PerfController', function PerfController(
  $scope, $window, $http, $location, $filter, ChangePointsService,
  DrawPerfTrendChart, PROCESSED_TYPE, Settings,
  TestSample, CANARY_EXCLUSION_REGEX, ApiTaskdata,
  loadBuildFailures, loadChangePoints, loadTrendData,
  trendDataComplete, loadWhitelist,
) {
  /* for debugging
  $sce, $compile){

var templateUrl = $sce.getTrustedResourceUrl('/plugin/perf/static/task_perf_data3.html');
$http.get(templateUrl).success(function(template) {
    // template is the HTML template as a string

    // Let's put it into an HTML element and parse any directives and expressions
    // in the code. (Note: This is just an example, modifying the DOM from within
    // a controller is considered bad style.)
    $compile($("#perfcontents").html(template).contents())($scope);
}, function() {});
*/
  // set this to false if we want the display to happen after the plots are rendered
  $scope.showToolbar = true
  $scope.hiddenGraphs = {}
  $scope.compareItemList = []
  $scope.perfTagData = {}
  $scope.compareForm = {}
  $scope.savedCompares = []
  $scope.trendResults = [];
  $scope.jiraHost = $window.jiraHost

  $scope.isGraphHidden = function (k) {
    return $scope.hiddenGraphs[k] == true
  }

  $scope.toggleGraph = function (k) {
    if (k in $scope.hiddenGraphs) {
      delete $scope.hiddenGraphs[k]
    } else {
      $scope.hiddenGraphs[k] = true
    }
    $scope.syncHash(-1)
  }

  $scope.syncHash = function (tab) {
    var hash = {}
    var locationHash = decodeURIComponent($location.hash());
    if (locationHash.length > 0) {
      hash = JSON.parse(locationHash)
    }
    if (Object.keys($scope.hiddenGraphs).length > 0) {
      hash.hiddenGraphs = Object.keys($scope.hiddenGraphs)
    }
    if (tab >= 0) {
      hash.perftab = tab
    }

    if ($scope.savedCompares.length > 0) {
      hash.compare = $scope.savedCompares
    } else {
      delete hash.compare
    }

    if ($scope.metricSelect.value != $scope.metricSelect.default) {
      hash.metric = $scope.metricSelect.value.key
    }

    $location.hash(encodeURIComponent(JSON.stringify(hash)))
    // Do not moify browser history
    $location.replace()
  }

  $scope.checkEnter = function (keyEvent) {
    if (keyEvent.which === 13) {
      compareItemList.push($scope.compareHash)
      $scope.compareHash = ''
    }
  }

  $scope.removeCompareItem = function (index) {
    $scope.comparePerfSamples.splice(index, 1);
    $scope.savedCompares.splice(index, 1);
    $scope.redrawGraphs()
    $scope.syncHash(-1)
  }

  $scope.deleteTag = function () {
    $http.delete("/plugin/json/task/" + $scope.task.id + "/perf/tag").then(
      function (resp) { delete $scope.perfTagData.tag; },
      function () { console.log("error") }
    );
  }

  // needed to do Math.abs in the template code.
  $scope.user = $window.user
  $scope.Math = $window.Math;
  $scope.conf = $window.plugins["perf"];
  $scope.task = $window.task_data;
  $scope.tablemode = 'maxthroughput';
  $scope.threadLevelsRadio = {
    options: [
      { key: 'maxonly', val: 'Max Only' },
      { key: 'all', val: 'All' }
    ],
    value: Settings.perf.trendchart.threadLevelMode,
  }

  $scope.metricSelect = {
    options: [],
    default: { key: 'ops_per_sec', name: 'ops/sec (Default)' },
    value: undefined,
  }
  $scope.metricSelect.options.push($scope.metricSelect.default)
  $scope.metricSelect.value = $scope.metricSelect.default

  // perftab refers to which tab should be selected. 0=graph, 1=table, 2=trend
  $scope.perftab = 2;
  $scope.project = $window.project;
  $scope.compareHash = "ss";
  $scope.comparePerfSamples = [];

  // Linear or Log Scale
  $scope.scaleModel = {
    name: 'Linear',
    linearMode: Settings.perf.trendchart.linearMode.enabled,
  }
  $scope.rangeModel = {
    name: 'Origin',
    originMode: Settings.perf.trendchart.originMode.enabled,
  }
  $scope.rejectModel = {
    name: 'Reject',
    rejectMode: Settings.perf.trendchart.rejectMode.enabled,
  };

  $scope.toolBar = {
    isOpen: false
  }

  $scope.$watch('scaleModel.linearMode', function (newVal, oldVal) {
    // Force comparison by value
    if (oldVal === newVal) return;
    Settings.perf.trendchart.linearMode.enabled = newVal
    $scope.redrawGraphs()
  })

  $scope.$watch('rangeModel.originMode', function (newVal, oldVal) {
    // Force comparison by value
    if (oldVal === newVal) return;
    Settings.perf.trendchart.originMode.enabled = newVal
    $scope.redrawGraphs()
  })

  $scope.$watch('rejectModel.rejectMode', function (newVal, oldVal) {
    // Force comparison by value
    if (oldVal === newVal) return;
    Settings.perf.trendchart.rejectMode.enabled = newVal;
    $scope.redrawGraphs();
  });

  $scope.$watch('threadLevelsRadio.value', function (newVal, oldVal) {
    // Force comparison by value
    if (oldVal === newVal) return;
    Settings.perf.trendchart.threadLevelMode = newVal
    $scope.redrawGraphs()
  })

  $scope.$watch('metricSelect.value', function (newVal, oldVal) {
    // Force comparison by value
    if (oldVal === newVal) return;
    $scope.syncHash(-1)
    $scope.redrawGraphs()
  })

  $scope.$watch('toolBar.isOpen', function (newVal, oldVal) {
    d3.selectAll('md-fab-toolbar').style('pointer-events', newVal ? 'all' : 'none')
  })

  $scope.$watch('currentHash', function () {
    $scope.hoverSamples = {}
    $scope.dateLabel = moment($scope.currentHashDate).format('ll')
    if (!!$scope.perfSample) {
      var testNames = $scope.perfSample.testNames()

      for (var i = 0; i < testNames.length; i++) {
        var s = $scope.allTrendSamples.sampleInSeriesAtCommit(
          testNames[i], $scope.currentHash
        )
        $scope.hoverSamples[testNames[i]] = s
      }
    }
  })

  const getSamples = (scope) => {
    if (scope.rejectModel.rejectMode) {
      return scope.filteredTrendSamples;
    } else {
      return scope.allTrendSamples;
    }
  };

  var drawTrendGraph = function (scope) {
    if (!$scope.perfSample) {
      return;
    }
    scope.locked = false;
    // Extract params
    let trendSamples = getSamples(scope),
      tests = scope.perfSample.testNames(),
      taskId = scope.task.id,
      compareSamples = scope.comparePerfSamples;
    if (!trendSamples) {
      return;
    }

    // Creates new, non-isolated scope for charts
    var chartsScope = scope.$new()
    for (var i = 0; i < tests.length; i++) {
      var key = tests[i];
      var series = _.filter(trendSamples.seriesByName[key] || [], function (sample) {
        return _.some(sample.threadResults, (singleResult) => {
          return singleResult[scope.metricSelect.value.key];
        });
      });
      var containerId = 'perf-trendchart-' + cleanId(taskId) + '-' + i;
      var cps = scope.changePoints || {};
      var bfs = scope.buildFailures || {};

      DrawPerfTrendChart({
        series: series || [],
        // Concat orfaned change points and build failures
        changePoints: (cps && cps[key] ? cps[key] : []).concat(cps[undefined] || []),
        buildFailures: (bfs && bfs[key] ? bfs[key] : []).concat(bfs[undefined] || []),
        key: key,
        scope: chartsScope,
        containerId: containerId,
        compareSamples: compareSamples,
        threadMode: scope.threadLevelsRadio.value,
        linearMode: scope.scaleModel.linearMode,
        originMode: scope.rangeModel.originMode,
        metric: scope.metricSelect.value.key,
      })
    }
    scope.showToolbar = true
  }

  // converts a percentage to a color. Higher -> greener, Lower -> redder.
  $scope.percentToColor = function (percent) {
    var percentColorRanges = [
      { min: -Infinity, max: -15, color: "#FF0000" },
      { min: -15, max: -10, color: "#FF5500" },
      { min: -10, max: -5, color: "#FFAA00" },
      { min: -5, max: -2.5, color: "#FEFF00" },
      { min: -2.5, max: 5, color: "#A9FF00" },
      { min: 5, max: 10, color: "#54FF00" },
      { min: 10, max: +Infinity, color: "#00FF00" }
    ];

    for (var i = 0; i < percentColorRanges.length; i++) {
      if (percent > percentColorRanges[i].min && percent <= percentColorRanges[i].max) {
        return percentColorRanges[i].color;
      }
    }
    return "";
  }

  $scope.percentDiff = function (val1, val2) {
    return (val1 - val2) / Math.abs(val2);
  }

  let cleanId = function (id) {
    return id.replace(/\./g, "-")
  }
  $scope.cleanId = cleanId

  function drawDetailGraph(sample, compareSamples, taskId, metricName) {
    if (!sample) {
      return;
    }
    var testNames = sample.testNames();
    for (var i = 0; i < testNames.length; i++) {
      var testName = testNames[i];
      $("#chart-" + cleanId(taskId) + "-" + i).empty();
      var series1 = sample.threadsVsOps(testName);
      var margin = { top: 20, right: 50, bottom: 30, left: 80 };
      var width = 450 - margin.left - margin.right;
      var height = 200 - margin.top - margin.bottom;
      var id = "chart-" + cleanId(taskId) + "-" + i;
      var svg = d3.select('[id="' + id + '"]')
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      var series = [series1];
      if (compareSamples) {
        for (var j = 0; j < compareSamples.length; j++) {
          var compareSeries = compareSamples[j].threadsVsOps(testName);
          if (compareSeries) {
            series.push(compareSeries);
          }
        }
      }

      var y
      if (d3.max(_.flatten(_.pluck(_.flatten(series), metricName + "_values")))) {
        y = d3.scale.linear()
          .domain([0, d3.max(_.flatten(_.pluck(_.flatten(series), metricName + "_values")))])
          .range([height, 0]);
      } else {
        y = d3.scale.linear()
          .domain([0, d3.max(_.flatten(_.pluck(_.flatten(series), metricName)))])
          .range([height, 0]);
      }

      var x = d3.scale.ordinal()
        .domain(_.pluck(_.flatten(series), "threads"))
        .rangeRoundBands([0, width]);
      var x1 = d3.scale.ordinal()
        .domain(d3.range(series.length))
        .rangeBands([0, x.rangeBand()], .3);

      var z = d3.scale.category10();

      var bar = svg.selectAll("g")
        .data(series)
        .enter().append("g")
        .style("fill", function (d, i) { return z(i); })
        .attr("transform", function (d, i) {
          let x = x1(i);
          if (Number.isNaN(x)) {
            x = 0;
          }
          return "translate(" + x + ",0)";
        });

      bar.selectAll("rect")
        .data(function (d) { return d })
        .enter().append("rect")
        .attr('stroke', 'black')
        .attr('x', function (d, i) {
          return x(d.threads);
        })
        .attr('y', function (d) {
          return y(d[metricName])
        })
        .attr('height', function (d) {
          return height - y(d[metricName]);
        })
        .attr("width", x1.rangeBand());

      var yAxis = d3.svg.axis()
        .scale(y)
        .orient("left");

      var errorBarArea = d3.svg.area()
        .x(function (d) {
          return x(d.threads) + (x1.rangeBand() / 2);
        })
        .y0(function (d) {
          return y(d3.min(d[metricName + "_values"]))
        })
        .y1(function (d) {
          return y(d3.max(d[metricName + "_values"]))
        }).interpolate("linear");

      bar.selectAll(".err")
        .data(function (d) {
          return d.filter(function (d) {
            return (metricName + "_values" in d) && (d[metricName + "_values"] != undefined && d[metricName + "_values"].length > 1);
          })
        })
        .enter().append("svg")
        .attr("class", "err")
        .append("path")
        .attr("stroke", "red")
        .attr("stroke-width", 1.5)
        .attr("d", function (d) {
          return errorBarArea([d]);
        });

      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");
      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis);
      svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);

      if (i == 0 && series.length > 1) {
        $('#legend').empty()
        var legendHeight = (series.length * 20);
        var legendWidth = 200;
        var legend_y = d3.scale.ordinal()
          .domain(d3.range(series.length))
          .rangeRoundBands([0, legendHeight], .2);
        var svg = d3.select("#legend")
          .append("svg")
          .attr("width", legendWidth)
          .attr("height", legendHeight + 10)
          .append("g");
        svg.selectAll("rect")
          .data(series)
          .enter()
          .append("rect")
          .attr("fill", function (d, i) { return z(i) })
          .attr("x", function (d, i) { return 0 })
          .attr("y", function (d, i) { return 5 + legend_y(i) })
          .attr("width", legendWidth / 3)
          .attr("height", legend_y.rangeBand());
        svg.selectAll("text")
          .data(series)
          .enter()
          .append("text")
          .attr("x", function (d, i) { return (legendWidth / 3) + 10 })
          .attr("y", function (d, i) { return legend_y(i) })
          .attr("dy", legend_y.rangeBand())
          .attr("class", "mono")
          .text(function (d, i) {
            if (i == 0) {
              return "this task";
            } else {
              return compareSamples[i - 1].getLegendName()//series.legendName
            }
          });
      }
    }
  }

  function markChangePoints(points, mark) {
    ChangePointsService.markPoints(points, mark).then(function () {
      $scope.$emit('changePointsUpdate', {
        pointRevs: _.pluck(points, 'suspect_revision'),
        processed_type: mark,
      })
    }, _.noop)
  }

  $scope.ackChangePoints = function (points) {
    markChangePoints(
      _.filter(points, (d) => d.processed_type === PROCESSED_TYPE.NONE),
      PROCESSED_TYPE.ACKNOWLEDGED
    )
  }

  $scope.hideChangePoints = function (points) {
    markChangePoints(
      _.filter(points, (d) => d.processed_type === PROCESSED_TYPE.NONE),
      PROCESSED_TYPE.HIDDEN
    )
  }

  $scope.unmarkChangePoints = function (points) {
    markChangePoints(
      _.filter(points, (d) => d.processed_type != PROCESSED_TYPE.NONE),
      PROCESSED_TYPE.NONE
    )
  }

  $scope.getSampleAtCommit = function (series, commit) {
    return _.find(series, function (x) { return x.revision == commit });
  }

  $scope.getCommits = function (seriesByName) {
    // get a unique list of all the revisions in the test series, accounting for gaps where some tests might have no data,
    // in order of push time.
    return _.uniq(_.pluck(_.sortBy(_.flatten(_.values(seriesByName)), "order"), "revision"), true);
  }

  $scope.setTaskTag = function (keyEvent) {
    if (keyEvent.which === 13) {
      $http.post("/plugin/json/task/" + $scope.task.id + "/perf/tag", { tag: $scope.perfTagData.input }).then(
        function (resp) { $scope.perfTagData.tag = $scope.perfTagData.input },
        function () { console.log("error") }
      );
    }
    return true
  }

  $scope.addComparisonForm = function (formData, draw) {
    const commitHash = formData.hash
    const saveObj = {}

    if (commitHash) {
      saveObj.hash = commitHash
    } else {
      saveObj.tag = formData.tag
    }

    if (Boolean(formData.tag) && Boolean(formData.tag.tag)) {
      formData.tag = formData.tag.tag
    }

    // Add only unique hashes and tags
    $scope.savedCompares = _.uniq($scope.savedCompares.concat(saveObj), function (d) {
      return '' + d.tag + d.hash
    })

    if (Boolean(commitHash)) {
      $http.get("/plugin/json/commit/" + $scope.project + "/" + commitHash + "/" + $scope.task.build_variant + "/" + $scope.task.display_name + "/perf").then(
        function (resp) {
          const d = resp.data;
          const compareSample = new TestSample(d);
          $scope.comparePerfSamples.push(compareSample)
          if (draw) $scope.redrawGraphs()
        },
        function (resp) { console.log(resp.data) });
    } else if (Boolean(formData.tag) && formData.tag.length > 0) {
      $http.get("/plugin/json/tag/" + $scope.project + "/" + formData.tag + "/" + $scope.task.build_variant + "/" + $scope.task.display_name + "/perf").then(
        function (resp) {
          const d = resp.data;
          const compareSample = new TestSample(d);
          $scope.comparePerfSamples.push(compareSample)
          if (draw) $scope.redrawGraphs()
        },
        function (resp) { console.log(resp.data) });
    }

    $scope.compareForm = {}
    $scope.syncHash(-1)
  }

  $scope.perfDiscoveryURL = function () {
    let url = "/perfdiscovery/#?from=" + $scope.task.version_id;
    if ($scope.comparePerfSamples && $scope.comparePerfSamples[0]) {
      url = url + "&to=" + $scope.comparePerfSamples[0].sample.version_id;
    }

    return url;
  }

  $scope.addComparisonHash = function (hash) {
    $scope.addComparisonForm({ hash: hash }, true)
  }

  $scope.redrawGraphs = function () {
    setTimeout(function () {
      $scope.hideEmptyGraphs();
      $scope.hideCanaries();
      drawTrendGraph($scope);
      drawDetailGraph($scope.perfSample, $scope.comparePerfSamples, $scope.task.id, $scope.metricSelect.value.key);
    }, 0)
  }

  $scope.hideEmptyGraphs = function () {
    let samples = getSamples($scope);
    let metric = $scope.metricSelect.value.key;
    if (samples) {
      let series = samples.seriesByName;
      $scope.hiddenGraphs = {};
      _.each(series, function (testResults, testName) {
        if (_.some(testResults, (singleResult) => { return singleResult[metric] })) {
          delete ($scope.hiddenGraphs[testName]);
        } else {
          $scope.hiddenGraphs[testName] = true;
        }
      });
    }
  }

  $scope.isCanary = function (test) {
    return !test.match(CANARY_EXCLUSION_REGEX);
  }

  $scope.hideCanaries = function () {
    if ($scope.perfSample) {
      $scope.perfSample.testNames().forEach(function (name) {
        if ($scope.isCanary(name)) {
          $scope.hiddenGraphs[name] = true;
        }
      });
    }
  }

  // Once the task data has been loaded
  $scope.processAndDrawGraphs = function () {
    setTimeout(function () { drawDetailGraph($scope.perfSample, $scope.comparePerfSamples, $scope.task.id, $scope.metricSelect.value.key) }, 0);

    const project = $scope.task.branch;
    const task_name = $scope.task.display_name;
    const variant = $scope.task.build_variant;

    // Set the samples and filtered samples.
    $scope.allTrendSamples = null;
    $scope.filteredTrendSamples = null;

    loadChangePoints($scope, project, variant, task_name).then(() => drawTrendGraph($scope));
    loadBuildFailures($scope, project, variant, task_name).then(() => drawTrendGraph($scope));

    const whitelistQ = loadWhitelist(project, variant, task_name).then(results => {
      $scope.whitelist = results.whitelist;
      $scope.outliers = results.points;
      return results
    });

    loadTrendData($scope, project, variant, task_name)
      .then(data => whitelistQ.then(() => data))
      .then(data => trendDataComplete($scope, data))
      .then(() => {
        $scope.hideEmptyGraphs();
        $scope.hideCanaries();
        drawTrendGraph($scope);
      });
  };

  if ($scope.conf.enabled) {
    if ($location.hash().length > 0) {
      try {
        var hashparsed = JSON.parse(decodeURIComponent($location.hash()))
        if ('hiddenGraphs' in hashparsed) {
          for (let i = 0; i < hashparsed.hiddenGraphs.length; i++) {
            $scope.hiddenGraphs[hashparsed.hiddenGraphs[i]] = true
          }
        }
        if ('perftab' in hashparsed) {
          $scope.perftab = hashparsed.perftab
        }
        if ('compare' in hashparsed) {
          for (let i = 0; i < hashparsed.compare.length; i++) {
            $scope.addComparisonForm(hashparsed.compare[i], false)
          }
        }
      } catch (e) { }
    }
    // Populate the graph and table for this task
    var legacySuccess = function (toMerge, resp) {
      var d = resp.data;
      var merged = $filter("mergePerfResults")(toMerge, d)
      $scope.perfSample = new TestSample(merged);
      if ("tag" in d && d.tag.length > 0) {
        $scope.perfTagData.tag = d.tag
      }
      $scope.processAndDrawGraphs();
    }
    var legacyError = function (error) {
      console.log(error);
      $scope.processAndDrawGraphs();
    }
    ApiTaskdata.cedarAPI("/rest/v1/perf/task_id/" + $scope.task.id).then(
      (resp) => {
        var formatted = $filter("expandedMetricConverter")(resp.data, $scope.task.execution);
        $scope.perfSample = new TestSample(formatted);
        return $http.get("/plugin/json/task/" + $scope.task.id + "/perf/").then((resp) => legacySuccess(formatted, resp), legacyError);
      },
      (error) => $http.get("/plugin/json/task/" + $scope.task.id + "/perf/").then((resp) => legacySuccess(null, resp), legacyError));

    $http.get("/plugin/json/task/" + $scope.task.id + "/perf/tags").then(
      function (resp) {
        const d = resp.data;
        $scope.tags = d.sort(function (a, b) { return a.tag.localeCompare(b.tag) })
      });

    if ($scope.task.patch_info && $scope.task.patch_info.Patch.Githash) {
      //pre-populate comparison vs. base commit of patch.
      $scope.addComparisonHash($scope.task.patch_info.Patch.Githash);
    }
  }
}).factory('trendDataComplete', function ($location, TrendSamples) {
  // Create a callback function to handle
  return function (scope, data) {
    const {legacy = [], cedar = []} = data;

    if (!scope.trendResults.length && scope.perfSample && scope.perfSample.sample) {
      scope.trendResults = scope.trendResults.concat(scope.perfSample.sample);
    }
    if (legacy && legacy.length) {
      scope.trendResults = scope.trendResults.concat(legacy);
    }
    if (cedar && cedar.length) {
      scope.trendResults = scope.trendResults.concat(cedar);
    }
    let rejects = scope.outliers ? scope.outliers.rejects : [];

    scope.allTrendSamples = new TrendSamples(scope.trendResults);
    // Default filtered to all.
    scope.filteredTrendSamples = scope.allTrendSamples;
    if (rejects.length && scope.trendResults.length) {
      rejects = _.filter(rejects, function (doc) {
        const matched = _.find(scope.whitelist, _.pick(doc, 'revision', 'project', 'variant', 'task'));
        return _.isUndefined(matched);
      });
      const filtered = _.reject(scope.trendResults, doc => _.contains(rejects, doc.task_id));
      if (filtered.length !== scope.trendResults.length) {
        scope.filteredTrendSamples = new TrendSamples(filtered);
      }
    }
    scope.metricSelect.options = scope.metricSelect.options.concat(
      _.map(
        _.without(scope.allTrendSamples.metrics, scope.metricSelect.default.key), d => ({ key: d, name: d }))
    );
    scope.metricSelect.options = _.uniq(scope.metricSelect.options, false, function (option) {
      return option.key;
    })

    // Some copy pasted checks
    if (scope.conf.enabled) {
      if ($location.hash().length > 0) {
        try {
          if ('metric' in hashparsed) {
            scope.metricSelect.value = _.findWhere(scope.metricSelect.options, { key: hashparsed.metric }) || scope.metricSelect.default
          }
        } catch (e) { }
      }
    }
    return data;
  };
}).factory('loadWhitelist', function ($q, PointsDataService, WhitelistDataService) {
  // Load the outliers and whitelist data.
  // This data is used to filter out rejected points from the trend charts.
  // The returned promise resolves when both the white list and outlier data is available.
  return function (project, variant, task) {
    // Get a list of rejected points.
    const points = PointsDataService.getOutlierPointsQ(project, variant, task);
    const whitelist= WhitelistDataService.getWhitelistQ({ project, variant, task });
    return $q.all({ points, whitelist });
  }
}).factory('loadTrendData', function ($http, $filter, $q, $log, ApiTaskdata) {
  // Attempt to load historical performance data from both the following sources:
  //    ** cedar and / or
  //    ** evergreen
  // The returned promise resolves when both the cedar and legacy data have evaluated.
  return function (scope, project, variant, task) {
    // Populate the trend data. Only one of the following will return successfully.
    const legacy = $http.get("/plugin/json/history/" + scope.task.id + "/perf")
      .then(resp => resp.data)
      .catch(err => $log.warn('error loading legacy data', err));

    const cedar = ApiTaskdata.cedarAPI("/rest/v1/perf/task_name/" + task +
      "?variant=" + variant + "&project=" + project)
      .then(resp => $filter("expandedHistoryConverter")(resp.data, scope.task.execution))
      .catch(err => $log.warn('error loading cedar data', err));

    return $q.all({legacy, cedar});
  }
}).factory('loadChangePoints', function ($q, loadUnprocessed, loadProcessed) {
  return function (scope, project, variant, task) {
    // Load the processed and unprocessed change points.
    // The returned promise resolves when both the white list and history data is available.
    const processed = loadProcessed(project, variant, task);
    const unprocessed = loadUnprocessed(project, variant, task);

    // Wait for processed / unprocessed and then merge processed and unprocessed change points.
    // Processed ones always have a priority (in situations, when the revision has one processed
    // and one unprocessed point).
    return $q.all({ processed, unprocessed }).then(function (points) {
      const { processed, unprocessed } = points;
      const docs = _.reduce(unprocessed, function (m, d) {
        // If there are no processed change point with same revision and test
        if (!_.findWhere(m, { suspect_revision: d.suspect_revision , test: d.test })) {
          return m.concat(d);
        }
        return m;
      }, processed);
      // Group all items by test
      scope.changePoints = _.groupBy(docs, 'test');
      return scope.changePoints;
    });
  }
}).factory('loadProcessed', function ($log, Stitch, STITCH_CONFIG) {
  return function (project, variant, task) {
    return Stitch.use(STITCH_CONFIG.PERF).query(function (db) {
      return db
        .db(STITCH_CONFIG.PERF.DB_PERF)
        .collection(STITCH_CONFIG.PERF.COLL_PROCESSED_POINTS)
        .find({ project, variant, task})
        .execute();
    }).then(
      docs => docs,
      err => {
        // Try to gracefully recover from an error
        $log.error('Cannot load processed change points!', err);
        return [];
      });
  }
}).factory('loadUnprocessed', function ($log, Stitch, STITCH_CONFIG) {
  return function (project, variant, task) {
    // This code loads change points for current task from the mdb cloud
    return Stitch.use(STITCH_CONFIG.PERF).query(function (db) {
      return db
        .db(STITCH_CONFIG.PERF.DB_PERF)
        .collection(STITCH_CONFIG.PERF.COLL_UNPROCESSED_POINTS)
        .find({
          project: project,
          variant: variant,
          task: task,
        })
        .execute();
    }).then(
      docs => docs,
      err => {
        // Try to gracefully recover from an error
        $log.error('Cannot load change points!', err);
        return []
      });
  }
}).factory('RevisionsMapper', function () {
  class RevisionsMapper {
    /**
     * Create a mapping between revisions and orders. Filter the mapping to
     * get the subset of revisions for this task only.
     *
     * @param points: a list of samples and get the mapping between
     * revisions and orders.
     * @param task_identifier: the information that identifies this task (specifically the
     * project, variant and task_name).
     */
    constructor(points, task_identifier) {
      this.points = points || [];
      this.task_identifier = task_identifier;

      this._allRevisionsMap = {};
      this._taskRevisionsMap = {};

      _.reduce(this.points, (mapper, point) => {
        mapper._allRevisionsMap[point.revision] = point.order;
        if (_.where(point.tasks, task_identifier).length) {
          mapper._taskRevisionsMap[point.revision] = point.order;
        }
        return mapper
      }, this);

      this._allOrdersMap = _.invert(this._allRevisionsMap)
      this._taskOrdersMap = _.invert(this._taskRevisionsMap)

      this._allOrders = Object.values(this._allRevisionsMap).map((val) => parseInt(val)).sort()
      this._taskOrders = Object.values(this._taskRevisionsMap).map((val) => parseInt(val)).sort()
    }

    /**
     * Return a doc to map from all known revisions to orders.
     */
    get allRevisionsMap() {
      return this._allRevisionsMap;
    };

    /**
     * Return a doc to map from all known task revisions to orders.
     */
    get taskRevisionsMap() {
      return this._taskRevisionsMap;
    };

    /**
     * Return a doc to map from all known orders to revisions.
     */
    get allOrdersMap() {
      return this._allOrdersMap;
    };

    /**
     * Return a doc to map from this tasks known orders to revisions.
     */
    get taskOrdersMap() {
      return this._taskOrdersMap;
    };

    /**
     * Return a list of all known orders.
     */
    get allOrders() {
      return this._allOrders;
    };

    /**
     * Return a list of the known task orders.
     */
    get taskOrders() {
      return this._taskOrders;
    };

  }
  return RevisionsMapper
}).factory('loadRevisions', function (Stitch, RevisionsMapper, STITCH_CONFIG) {
  return function (project, variant, task) {
    // Load revisions to orders from the points collection.
    // const task_identifier = { project: $scope.task.branch, task: $scope.task.display_name, variant: $scope.task.build_variant };
    const task_identifier = { project: project, variant: variant, task: task };
    const pipeline = [
      { $match: { project: project } },
      {
        "$group": {
          "_id": { revision: "$revision", order: '$order' },
          "tasks": { $addToSet: { project: '$project', variant: '$variant', task: '$task' } }
        }
      },
      { $project: { revision: '$_id.revision', order: '$_id.order', tasks: 1, _id: 0 } },
      { $sort: { order: 1 } }
    ];

    return Stitch.use(STITCH_CONFIG.PERF).query(function (db) {
      return db
        .db(STITCH_CONFIG.PERF.DB_PERF)
        .collection(STITCH_CONFIG.PERF.COLL_POINTS)
        .aggregate(pipeline);
    }).catch(err => null)
      .then((points) => new RevisionsMapper(points, task_identifier))
  }
}).factory('loadBuildFailures', function ($log, Stitch, STITCH_CONFIG, loadRevisions) {
  return function (scope, project, variant, task_name) {
    const revisionsQ = loadRevisions(project, variant, task_name);

    return Stitch.use(STITCH_CONFIG.PERF).query(function (db) {
      return db
        .db(STITCH_CONFIG.PERF.DB_PERF)
        .collection(STITCH_CONFIG.PERF.COLL_BUILD_FAILURES)
        .aggregate([
          {
            $match: {
              project: project,
              buildvariants: variant,
              tasks: task_name,
            }
          },
          // Denormalization
          { $unwind: { path: '$tests', preserveNullAndEmptyArrays: true } },
          { $unwind: { path: '$first_failing_revision', preserveNullAndEmptyArrays: true } },
        ]);
    }).then(
      docs => {
        return revisionsQ.then(lookups => {
          scope.lookups = lookups;
          _.each(docs, doc => {
            // Get the exact order.
            const task_order = scope.lookups.taskRevisionsMap[doc.first_failing_revision] || null;
            doc.order = task_order;
            doc.orders = [task_order];
            if (!task_order) {
              const order = scope.lookups.allRevisionsMap[doc.first_failing_revision] || null;
              // order can be undefined if this revision is for another project.
              if (order) {
                const closest = scope.lookups.taskOrders.sort((a, b) => Math.abs(a - order) - Math.abs(b - order));
                doc.orders = [order, closest.find(i => i > order)];
                doc.order = order;
              }
            }
            doc.revisions = doc.orders.map(order => (scope.lookups.allOrdersMap[order]  || null))
          });
          scope.buildFailures = _.groupBy(docs, 'tests');
          return scope.buildFailures;
        })
      }, err => {
        $log.error('Cannot load build failures!', err);
        return {} // Try to recover an error
      })
  }
});
