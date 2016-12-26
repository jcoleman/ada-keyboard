// Measurements from ErgoDox design.
var SWITCH_PLATE_THICKNESS = 3;
var SWITCH_HOLE_SIZE = 13.97;
var SWITCH_NOTCH_WIDTH = 3.5001;
var SWITCH_NOTCH_DEPTH = 0.8128;

var SWITCH_CENTER_Y_SPACING = 19;
var SWITCH_CENTER_X_SPACING = 19;

// Returns the filled solid of a switch hole.
function switchHole(opts={thickness: SWITCH_PLATE_THICKNESS}) {
  var thickness = opts.thickness;
  var holeRadius = SWITCH_HOLE_SIZE / 2;
  var plateRadius = thickness / 2;
  var square = CSG.cube({
    radius: [holeRadius, holeRadius, plateRadius],
  });
  var notch = CSG.cube({
    radius: [SWITCH_NOTCH_DEPTH / 2, SWITCH_NOTCH_WIDTH / 2, plateRadius],
  });
  var notchCenterOffset = holeRadius - SWITCH_NOTCH_DEPTH / 2;

  var hole = square.subtract(
    notch.translate([notchCenterOffset, 0])
  ).subtract(
    notch.translate([-notchCenterOffset, 0])
  );

  // Point, axis, perpendicular axis
  hole.properties.center = new CSG.Connector([0, 0, 0], [0, 0, 1], [0, 1, 0]);

  return hole;
}

function switchPlateLeftHand() {
  var plate = CSG.cube({radius: [200, 200, SWITCH_PLATE_THICKNESS/2]});

  var primaryKeyPlacementMatrix = [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 1],
  ];
  var columnOffsets = [-18, -19, -5, 0, -6, -11];

  var primaryKeySwitchMatrix = [];
  for (var row = 0; row < primaryKeyPlacementMatrix.length; ++row) {
    var rowOfSwitches = [];
    primaryKeySwitchMatrix.push(rowOfSwitches);
    var baseY = -100 + (row * SWITCH_CENTER_Y_SPACING);
    for (var col = 0; col < primaryKeyPlacementMatrix[row].length; ++col) {
      var keySwitch = null;
      if (primaryKeyPlacementMatrix[row][col] == 1) {
        var baseX = -100 + (col * SWITCH_CENTER_X_SPACING);
        keySwitch = switchHole();
        var switchCenter = [baseX, baseY - columnOffsets[col], 0];
        var plateConnector = new CSG.Connector(switchCenter, [0, 0, 1], [0, 1, 0]);
        plate.properties["switch_" + row + "_" + col] = plateConnector;
        var sc = keySwitch.scounter;
        keySwitch = keySwitch.connectTo(keySwitch.properties.center, plateConnector, true, 0);
        keySwitch.scounter = sc;
      }
      rowOfSwitches.push(keySwitch);
    }
  }

  var thumbKeySwitchMatrix = [];
  for (var row = 0; row < 2; ++row) {
    var baseY = row * SWITCH_CENTER_Y_SPACING;
    thumbKeySwitchMatrix.push([]);
    for (var col = 0; col < 2; ++col) {
      var baseX = col * SWITCH_CENTER_X_SPACING;
      var keySwitch = switchHole();
      var columnOffset = -col * 2;
      var parentCenter = null;
      var parentSwitch = null;
      if (col > 0) {
        // Connect switch to previous switch in row.
        parentSwitch = thumbKeySwitchMatrix[row][col - 1];
        parentCenter = [SWITCH_CENTER_X_SPACING, columnOffset, 0];
      } else if (row > 0) {
        // Connect switch to first switch in previous row.
        parentSwitch = thumbKeySwitchMatrix[row - 1][col];
        parentCenter = [baseX, -SWITCH_CENTER_Y_SPACING, 0];
      } else {
        // Connect first switch to achor in primary matrix.
        var point = [0, -SWITCH_CENTER_Y_SPACING, 0];
        var connector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
        keySwitch.properties.parentSwitchCenter = connector;
        var thumbMatrixParentRow = primaryKeySwitchMatrix[primaryKeySwitchMatrix.length - 2];
        var thumbMatrixParentSwitch = thumbMatrixParentRow[thumbMatrixParentRow.length - 1];
        keySwitch = keySwitch.connectTo(connector, thumbMatrixParentSwitch.properties.center, false, 0);
      }

      if (parentSwitch) {
        var parentConnector = new CSG.Connector(parentCenter, [0, 0, 1], [0, 1, 0]);
        keySwitch.properties.parentSwitchCenter = parentConnector;
        keySwitch = keySwitch.connectTo(parentConnector, parentSwitch.properties.center, false, 0);
      }
      thumbKeySwitchMatrix[row].push(keySwitch);
    }
  }

  var switches = [];
  var matrices = [primaryKeySwitchMatrix, thumbKeySwitchMatrix];
  for (var h = 0; h < matrices.length; ++h) {
    var matrix = matrices[h];
    for (var i = 0; i < matrix.length; ++i) {
      var row = matrix[i];
      for (var j = 0; j < row.length; ++j) {
        if (row[j]) {
          switches.push(row[j]);
        }
      }
    }
  }
  for (var i = 0; i < switches.length; ++i) {
    plate = plate.subtract(switches[i]);
  }
  return plate;
}

function main() {
  return switchPlateLeftHand();
}

