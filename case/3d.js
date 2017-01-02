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
        ownLocation: [row, col],
      };

      var baseX = col * SWITCH_CENTER_X_SPACING;
      if (col > 0) {
        // Connect switch to previous switch in row.
        result.parentSwitchLocation = [row, col - 1];
        var point = [-SWITCH_CENTER_X_SPACING, -columnOffsets[col] || 0, 0];
        result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
      } else if (row > 0) {
        // Connect switch to first switch in previous row.
        result.parentSwitchLocation = [row - 1, col];
        var point = [baseX + (rowOffsets[row] || 0), SWITCH_CENTER_Y_SPACING, 0];
        result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
      } else {
        // Switch at [0, 0] will be connected later.
      }

      result.present = placementMatrix[row][col] == 1;

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
function connectSwitchesInDescriptorMatrix(matrix, opts={center: false}) {
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
        var updatedKeySwitch = descriptor.keySwitch
        if (opts.center) {
          updatedKeySwitch = updatedKeySwitch.center();
        }
        updatedKeySwitch = updatedKeySwitch.connectTo(
          descriptor.parentConnector,
          parentObject.properties[descriptor.parentObjectConnectorName || "center"],
          false,
          0
        );
        descriptor.keySwitch = updatedKeySwitch;
      }
    }
  }
}

function hullForMatrix(matrix, opts={radiusFromSwitchHole: 0}) {
  var borderSwitches = [];

  // Top row
  for (var col = 0; col < matrix[0].length; ++col) {
    for (var row = 0; row < matrix.length; ++row) {
      if (matrix[row][col].present) {
        borderSwitches.push(matrix[row][col]);
        break;
      }
    }
  }

  // Right column
  for (var row = 0; row < matrix.length; ++row) {
    for (var col = matrix[row].length - 1; col >= 0; --col) {
      if (matrix[row][col].present) {
        borderSwitches.push(matrix[row][col]);
        break;
      }
    }
  }

  // Bottom row
  for (var col = matrix[0].length - 1; col >= 0; --col) {
    for (var row = matrix.length - 1; row >= 0; --row) {
      if (matrix[row][col].present) {
        borderSwitches.push(matrix[row][col]);
        break;
      }
    }
  }

  // Left column
  for (var row = matrix.length - 1; row >= 0; --row) {
    for (var col = 0; col < matrix[row].length; ++col) {
      if (matrix[row][col].present) {
        borderSwitches.push(matrix[row][col]);
        break;
      }
    }
  }

  // Generate bounding squares for each switch.
  var borderSquares = [];
  for (var i = 0; i < borderSwitches.length; ++i) {
    var bounds = borderSwitches[i].keySwitch.getBounds();
    var center = [(bounds[0].x + bounds[1].x) / 2, (bounds[0].y + bounds[1].y) / 2];
    var square = CAG.rectangle({center: center, radius: (SWITCH_CENTER_Y_SPACING / 2) + opts.radiusFromSwitchHole});
    borderSquares.push(square);
  }

  return hull(borderSquares);
}

function switchPlateLeftHand() {
  var primaryMatrix = buildUnconnectedSwitchDescriptorMatrix({
    placementMatrix: [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0],
    ],
    columnOffsets: [0, -4, 14, 5, -6, -5],
    rowOffsets: [],
  });

  var thumbMatrix = buildUnconnectedSwitchDescriptorMatrix({
    placementMatrix: [
      [1, 1],
      [1, 1],
    ],
    columnOffsets: [0, -2],
    rowOffsets: [],
  });

  // Layout initial relative switch positions for primary matrix (required for hull calculation).
  connectSwitchesInDescriptorMatrix(primaryMatrix, {center: true});

  // Set up connection from thumb matrix to primary matrix.
  var thumbMatrixParentRow = primaryMatrix[primaryMatrix.length - 2];
  var thumbMatrixParent = thumbMatrixParentRow[thumbMatrixParentRow.length - 1];
  thumbMatrix[0][0].parentObject = thumbMatrixParent.keySwitch;
  thumbMatrix[0][0].parentConnector = new CSG.Connector([0, SWITCH_CENTER_Y_SPACING, 0], [0, 0, 1], [0, 1, 0]);

  // Layout initial relative switch positions for thumb matrix (required for hull calculation).
  connectSwitchesInDescriptorMatrix(thumbMatrix, {center: true});

  var primaryExteriorHull = hullForMatrix(primaryMatrix, {radiusFromSwitchHole: 10});
  var primarySwitchPlate = linear_extrude({radius: SWITCH_PLATE_THICKNESS / 2}, primaryExteriorHull);

  var thumbExteriorHull = hullForMatrix(thumbMatrix, {radiusFromSwitchHole: 10});
  var thumbSwitchPlate = linear_extrude({radius: SWITCH_PLATE_THICKNESS / 2}, thumbExteriorHull);

  // Connect primary matrix to primary switch plate.
  primaryMatrix[0][0].parentObject = primarySwitchPlate;
  primaryMatrix[0][0].parentObjectConnectorName = "primarySwitchPlateConnector";
  primarySwitchPlate.properties.primarySwitchPlateConnector = new CSG.Connector(
    primaryMatrix[0][0].keySwitch.properties.center.point,
    [0, 0, 1],
    [0, 1, 0]
  );
  // These two points are intentionally identical.
  primaryMatrix[0][0].parentConnector = primarySwitchPlate.properties.primarySwitchPlateConnector;
  connectSwitchesInDescriptorMatrix(primaryMatrix, {center: true});

  // Connect thumb switch plate to thumb matrix.
  thumbSwitchPlate.properties.thumbMatrixConnector = new CSG.Connector(
    thumbMatrix[0][0].keySwitch.properties.center.point,
    [0, 0, 1],
    [0, 1, 0]
  );
  thumbSwitchPlate = thumbSwitchPlate.connectTo(
    thumbSwitchPlate.properties.thumbMatrixConnector,
    thumbMatrix[0][0].keySwitch.properties.center,
    false,
    0
  );

  var switches = [];
  var matrices = [primaryMatrix, thumbMatrix];
  for (var h = 0; h < matrices.length; ++h) {
    var matrix = matrices[h];
    for (var i = 0; i < matrix.length; ++i) {
      var row = matrix[i];
      for (var j = 0; j < row.length; ++j) {
        if (row[j].present) {
          switches.push(row[j].keySwitch);
        }
      }
    }
  }

  var switchPlate = primarySwitchPlate.union(thumbSwitchPlate);
  for (var i = 0; i < switches.length; ++i) {
    switchPlate = switchPlate.subtract(switches[i]);
  }
  return switchPlate;
}

function main() {
  return switchPlateLeftHand();
}

