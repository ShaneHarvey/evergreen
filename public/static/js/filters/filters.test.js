describe('FiltersTest', function() {
  beforeEach(module('MCI'));

  let statusLabel

  beforeEach(inject(function($injector) {
    let $filter = $injector.get('$filter')
    statusLabel = $filter('statusLabel')
  }))


  describe('statusLabel filter test', function() {
    it('Tasks with overriden dependencies are not blocked', function() {
      expect(
        statusLabel({
          task_waiting: 'blocked',
          override_dependencies: true,
          status: 'success'
        })
      ).toBe('success')
    })

    it('Successfull tasks displayed as successfull', function() {
      expect(
        statusLabel({status: 'success'})
      ).toBe('success')
    })

    it('Waiting tasks displayed as blocked', function() {
      expect(
        statusLabel({task_waiting: 'blocked'})
      ).toBe('blocked')
    })
  })
});

describe('expandedHistoryConverter', function() {
  beforeEach(module('MCI'));

  let expandedHistoryConverter;
  let rawData = [
    {
      "name" : "8ff0d32307c7d1bc7afa4b30ce4366d5f9f22850",
      "info" : {
        "project" : "sys-perf",
        "version" : "sys_perf_4807c2165b552670c9fe66c79c6d5be34e845023",
        "order" : 18362,
        "variant" : "linux-1-node-15gbwtcache",
        "task_name" : "out_of_cache_scanner",
        "task_id" : "sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37",
        "execution" : 0,
        "test_name" : "out_of_cache_scanner",
        "trial" : 0,
        "parent" : "",
        "tags" : null,
        "args" : null
      },
      "created_at" : "2019-09-06T01:14:10.000Z",
      "completed_at" : "2019-09-06T02:03:19.000Z",
      "artifacts" : null,
      "rollups" : {
        "stats" : null,
        "processed_at" : null,
        "valid" : false
      }
    },
    {
      "name" : "4bc9e4beb31e36d3cd83adbd75f5f8eb63c5a09c",
      "info" : {
        "project" : "sys-perf",
        "version" : "sys_perf_4807c2165b552670c9fe66c79c6d5be34e845023",
        "order" : 18362,
        "variant" : "linux-1-node-15gbwtcache",
        "task_name" : "out_of_cache_scanner",
        "task_id" : "sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37",
        "execution" : 0,
        "test_name" : "ColdScanner-Scan.2",
        "trial" : 0,
        "parent" : "8ff0d32307c7d1bc7afa4b30ce4366d5f9f22850",
        "tags" : null,
        "args" : null
      },
      "created_at" : "2019-09-06T01:14:10.000Z",
      "completed_at" : "2019-09-06T02:03:19.000Z",
      "artifacts" : [
        {
          "type" : "s3",
          "bucket" : "genny-metrics",
          "prefix" : "sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37_0",
          "path" : "ColdScanner-Scan.2",
          "format" : "ftdc",
          "compression" : "none",
          "schema" : "raw-events",
          "tags" : null,
          "created_at" : "2019-09-06T02:03:23.790Z",
          "download_url" : "https://genny-metrics.s3.amazonaws.com/sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37_0/ColdScanner-Scan.2"
        }
      ],
      "rollups" : {
        "stats" : [
          {
            "name" : "AverageLatency",
            "val" : 7010.185110530556,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "AverageSize",
            "val" : 130,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "OperationThroughput",
            "val" : 2059576.0991914733,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "SizeThroughput",
            "val" : 267744892.89489153,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "ErrorRate",
            "val" : 0,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "Latency50thPercentile",
            "val" : 780947002426.5,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "Latency80thPercentile",
            "val" : 1104667169411,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "Latency90thPercentile",
            "val" : 1104678496947.6333,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "Latency95thPercentile",
            "val" : 1104684900770,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "Latency99thPercentile",
            "val" : 1104684900770,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "WorkersMin",
            "val" : 6,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "WorkersMax",
            "val" : 6,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "LatencyMin",
            "val" : 697970870799,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "LatencyMax",
            "val" : 1104684900770,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "DurationTotal",
            "val" : 699173000000,
            "version" : 4,
            "user" : false
          },
          {
            "name" : "ErrorsTotal",
            "val" : 0,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "OperationsTotal",
            "val" : 1440000000,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "SizeTotal",
            "val" : 187200000000,
            "version" : 3,
            "user" : false
          },
          {
            "name" : "OverheadTotal",
            "val" : 6057087203,
            "version" : 1,
            "user" : false
          }
        ],
        "processed_at" : null,
        "valid" : false
      }
    }
  ];

  beforeEach(inject(function($injector) {
    const $filter = $injector.get('$filter');
    expandedHistoryConverter = $filter('expandedHistoryConverter');
  }));

  it('should handle empty', function() {
    expect(expandedHistoryConverter(undefined)).toBe(null);
    expect(expandedHistoryConverter(null)).toBe(null);
    expect(expandedHistoryConverter([])).toEqual([]);
  });

  it('should convert data', function() {
    expect(expandedHistoryConverter(rawData)).toEqual([
      {
        "data": {
          "results": []
        },
        "create_time": "2019-09-06T01:14:10.000Z",
        "order": 18362,
        "version_id": "sys_perf_4807c2165b552670c9fe66c79c6d5be34e845023",
        "project_id": "sys-perf",
        "task_name": "out_of_cache_scanner",
        "variant": "linux-1-node-15gbwtcache",
        "task_id": "sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37",
        "revision": "4807c2165b552670c9fe66c79c6d5be34e845023"
      },
      {
        "data": {
          "results": [
            {
              "name": "ColdScanner-Scan.2",
              "isExpandedMetric": true,
              "results": {
                "6": {
                  "AverageLatency": 7010.185110530556,
                  "AverageLatency_values": [
                    7010.185110530556
                  ],
                  "AverageSize": 130,
                  "AverageSize_values": [
                    130
                  ],
                  "OperationThroughput": 2059576.0991914733,
                  "OperationThroughput_values": [
                    2059576.0991914733
                  ],
                  "SizeThroughput": 267744892.89489153,
                  "SizeThroughput_values": [
                    267744892.89489153
                  ],
                  "ErrorRate": 0,
                  "ErrorRate_values": [
                    0
                  ],
                  "Latency50thPercentile": 780947002426.5,
                  "Latency50thPercentile_values": [
                    780947002426.5
                  ],
                  "Latency80thPercentile": 1104667169411,
                  "Latency80thPercentile_values": [
                    1104667169411
                  ],
                  "Latency90thPercentile": 1104678496947.6333,
                  "Latency90thPercentile_values": [
                    1104678496947.6333
                  ],
                  "Latency95thPercentile": 1104684900770,
                  "Latency95thPercentile_values": [
                    1104684900770
                  ],
                  "Latency99thPercentile": 1104684900770,
                  "Latency99thPercentile_values": [
                    1104684900770
                  ],
                  "WorkersMin": 6,
                  "WorkersMin_values": [
                    6
                  ],
                  "WorkersMax": 6,
                  "WorkersMax_values": [
                    6
                  ],
                  "LatencyMin": 697970870799,
                  "LatencyMin_values": [
                    697970870799
                  ],
                  "LatencyMax": 1104684900770,
                  "LatencyMax_values": [
                    1104684900770
                  ],
                  "DurationTotal": 699173000000,
                  "DurationTotal_values": [
                    699173000000
                  ],
                  "ErrorsTotal": 0,
                  "ErrorsTotal_values": [
                    0
                  ],
                  "OperationsTotal": 1440000000,
                  "OperationsTotal_values": [
                    1440000000
                  ],
                  "SizeTotal": 187200000000,
                  "SizeTotal_values": [
                    187200000000
                  ],
                  "OverheadTotal": 6057087203,
                  "OverheadTotal_values": [
                    6057087203
                  ]
                }
              }
            }
          ]
        },
        "create_time": "2019-09-06T01:14:10.000Z",
        "order": 18362,
        "version_id": "sys_perf_4807c2165b552670c9fe66c79c6d5be34e845023",
        "project_id": "sys-perf",
        "task_name": "out_of_cache_scanner",
        "variant": "linux-1-node-15gbwtcache",
        "task_id": "sys_perf_linux_1_node_15gbwtcache_out_of_cache_scanner_4807c2165b552670c9fe66c79c6d5be34e845023_19_09_04_18_45_37",
        "revision": "4807c2165b552670c9fe66c79c6d5be34e845023"
      }
    ])
  })
});
