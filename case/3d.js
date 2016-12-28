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

// Builds a matrix of key switch descriptors that are unconnected
// but contain the information to be connected.
// The first switch (at coordinates[0, 0]) will not have connecting
// information.
function buildUnconnectedSwitchDescriptorMatrix(opts={placementMatrix: [[]], columnOffsets: [], rowOffsets: []}) {
  var placementMatrix = opts.placementMatrix;
  var columnOffsets = opts.columnOffsets;
  var rowOffsets = opts.rowOffsets;
  var resultMatrix = [];

  for (var row = 0; row < placementMatrix.length; ++row) {
    var baseY = row * SWITCH_CENTER_Y_SPACING;
    resultMatrix.push([]);
    for (var col = 0; col < placementMatrix[row].length; ++col) {
      var result = {
        keySwitch: switchHole(),
        parentSwitchLocation: null,
        parentConnector: null,
      };
      result.ownLocation = [row, col];
      var baseX = col * SWITCH_CENTER_X_SPACING;
      if (col > 0) {
        // Connect switch to previous switch in row.
        result.parentSwitchLocation = [row, col - 1];
        var point = [SWITCH_CENTER_X_SPACING, columnOffsets[col] || 0, 0];
        result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
      } else if (row > 0) {
        // Connect switch to first switch in previous row.
        result.parentSwitchLocation = [row - 1, col];
        var point = [baseX + (rowOffsets[row] || 0), -SWITCH_CENTER_Y_SPACING, 0];
        result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
      } else {
        // Switch at [0, 0] will be connected later.
      }
      resultMatrix[row].push(result);
    }
  }

  return resultMatrix;
}

// Add connections between the switches in an unconnected
// descriptor matrix.
// We have to delay adding these connections until after the
// connection information (if any) is added to the switch in
// this matrix that links it to another object since connections
// don't cause cascading changes.
function connectSwitchesInDescriptorMatrix(matrix) {
  for (var row = 0; row < matrix.length; ++row) {
    for (var col = 0; col < matrix[row].length; ++col) {
      var descriptor = matrix[row][col];
      var parentObject = null;
      if (descriptor.parentObject) {
        parentObject = descriptor.parentObject;
      } else if (descriptor.parentSwitchLocation) {
        var parentDescriptor = matrix;
        for (var i = 0; i < descriptor.parentSwitchLocation.length; ++i) {
          parentDescriptor = parentDescriptor[descriptor.parentSwitchLocation[i]];
        }
        parentObject = parentDescriptor.keySwitch;
      }
      if (parentObject) {
        if (!descriptor.keySwitch.properties.parentSwitchCenter && descriptor.parentConnector) {
          descriptor.keySwitch.properties.parentSwitchCenter = descriptor.parentConnector;
        }
        var updatedKeySwitch = descriptor.keySwitch.connectTo(
          descriptor.parentConnector,
          parentObject.properties.center,
          false,
          0
        );
        descriptor.keySwitch = updatedKeySwitch;
      }
    }
  }
};

function switchPlateLeftHand() {
  var plate = CSG.cube({radius: [200, 200, SWITCH_PLATE_THICKNESS/2]});

  var primaryKeyPlacementMatrix = [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 1],
  ];
  var columnOffsets = [-15, -19, -5, 0, -6, -11];

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

  var thumbMatrix = buildUnconnectedSwitchDescriptorMatrix({
    placementMatrix: [
      [1, 1],
      [1, 1],
    ],
    columnOffsets: [0, -2],
    rowOffsets: [],
  });

  // Set up connection from thumb matrix to primary matrix.
  var point = [0, -SWITCH_CENTER_Y_SPACING, 0];
  var connector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
  thumbMatrix[0][0].keySwitch.properties.parentSwitchCenter = connector;
  var thumbMatrixParentRow = primaryKeySwitchMatrix[primaryKeySwitchMatrix.length - 1];
  var thumbMatrixParentSwitch = thumbMatrixParentRow[thumbMatrixParentRow.length - 1];
  thumbMatrix[0][0].parentObject = thumbMatrixParentSwitch;
  thumbMatrix[0][0].parentConnector = connector;

  connectSwitchesInDescriptorMatrix(thumbMatrix);

  var switches = [];
  var matrices = [primaryKeySwitchMatrix, thumbMatrix];
  for (var h = 0; h < matrices.length; ++h) {
    var matrix = matrices[h];
    for (var i = 0; i < matrix.length; ++i) {
      var row = matrix[i];
      for (var j = 0; j < row.length; ++j) {
        if (row[j]) {
          switches.push(row[j].keySwitch || row[j]);
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

