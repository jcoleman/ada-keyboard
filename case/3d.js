// Measurements from ErgoDox design.
var SWITCH_PLATE_THICKNESS = 3;
var SWITCH_HOLE_SIZE = 13.97;
var SWITCH_NOTCH_WIDTH = 3.5001;
var SWITCH_NOTCH_DEPTH = 0.8128;

var SWITCH_CENTER_Y_SPACING = 19;
var SWITCH_CENTER_X_SPACING = 19;

function getParameterDefinitions() {
  return [
    {
      name: "center",
      type: "checkbox",
      checked: "checked",
      caption: "Center the result",
    },
    {
      name: "displayKeyCapsForDebugging",
      type: "checkbox",
      checked: "",
      caption: "Display key caps to debug for overlapping caps",
    },
    {
      name: "displayDebuggingCoordinateLabels",
      type: "checkbox",
      checked: "",
      caption: "Display +/- X/Y coordinate labels for debugging purposes",
    },
  ];
}

function installLibraryExtensions() {
  CSG.prototype.getBoundsCenter = function() {
    var bounds = this.getBounds();
    return new CSG.Vector3D([
      (bounds[0].x + bounds[1].x) / 2,
      (bounds[0].y + bounds[1].y) / 2,
      (bounds[0].z + bounds[1].z) / 2,
    ]);
  }
}

function keyCap() {
  var cap = CSG.cube({
    radius: [17.9 / 2, 17.9 / 2, 8 / 2],
  });
  var capBaseZ = cap.getBounds()[0].z;
  var support = CSG.cylinder({
    start: [0, 0, capBaseZ],
    end: [0, 0, capBaseZ - 6.4],
    radius: 4,
  });
  cap = cap.union(support);
  cap = cap.translate([0, 0, -cap.getBounds()[0].z]);
  cap.properties.baseCenter = new CSG.Connector([0, 0, 0], [0, 0, 1], [0, 1, 0]);
  return cap.setColor([0, 0, 1]);
}

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
        cap: keyCap(),
        parentSwitchLocation: null,
        parentConnector: null,
        ownLocation: [row, col],
      };

      var baseX = col * SWITCH_CENTER_X_SPACING;
      var rowOffset = rowOffsets[row] || 0;
      var colOffset = columnOffsets[col] || 0;
      if (rowOffset != 0 && colOffset != 0) {
        throw new Error("Having row offsets and column offsets simultaneously is not supported because it will cause key cap overlap.");
      }
      if (col > 0) {
        // Connect switch to previous switch in row.
        result.parentSwitchLocation = [row, col - 1];
        var point = [-SWITCH_CENTER_X_SPACING, -colOffset, 0];
        result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
      } else if (row > 0) {
        // Connect switch to first switch in previous row.
        result.parentSwitchLocation = [row - 1, col];
        var point = [baseX - rowOffset, SWITCH_CENTER_Y_SPACING, 0];
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
        var updatedCap = descriptor.cap;
        if (opts.center) {
          updatedKeySwitch = updatedKeySwitch.center();
          updatedCap = updatedCap.center();
        }
        updatedKeySwitch = updatedKeySwitch.connectTo(
          descriptor.parentConnector,
          parentObject.properties[descriptor.parentObjectConnectorName || "center"],
          false,
          0
        );
        descriptor.keySwitch = updatedKeySwitch;
        descriptor.cap = updatedCap.connectTo(
          updatedCap.properties.baseCenter,
          descriptor.keySwitch.properties.center,
          false,
          0
        );
      }
    }
  }
}

function hullForMatrix(matrix, opts={radius: 0, offset: {}}) {
  var radius = opts.radius || 0;
  var offset = opts.offset || {};

  var topRow = [];
  for (var col = 0; col < matrix[0].length; ++col) {
    for (var row = 0; row < matrix.length; ++row) {
      if (matrix[row][col].present) {
        topRow.push(matrix[row][col].keySwitch.translate([0, offset.top || 0, 0]));
        break;
      }
    }
  }

  var rightColumn = [];
  for (var row = 0; row < matrix.length; ++row) {
    for (var col = matrix[row].length - 1; col >= 0; --col) {
      if (matrix[row][col].present) {
        rightColumn.push(matrix[row][col].keySwitch.translate([offset.right || 0, 0, 0]));
        break;
      }
    }
  }

  var bottomRow = [];
  for (var col = matrix[0].length - 1; col >= 0; --col) {
    for (var row = matrix.length - 1; row >= 0; --row) {
      if (matrix[row][col].present) {
        bottomRow.push(matrix[row][col].keySwitch.translate([0, offset.bottom || 0, 0]));
        break;
      }
    }
  }

  var leftColumn = [];
  for (var row = matrix.length - 1; row >= 0; --row) {
    for (var col = 0; col < matrix[row].length; ++col) {
      if (matrix[row][col].present) {
        leftColumn.push(matrix[row][col].keySwitch.translate([offset.left || 0, 0, 0]));
        break;
      }
    }
  }

  // Generate bounding squares for each switch.
  var borderSquares = [];
  var borderSegments = [topRow, rightColumn, bottomRow, leftColumn];
  for (var segment = 0; segment < borderSegments.length; ++segment) {
    for (var i = 0; i < borderSegments[segment].length; ++i) {
      var bounds = borderSegments[segment][i].getBounds();
      var center = [(bounds[0].x + bounds[1].x) / 2, (bounds[0].y + bounds[1].y) / 2];
      var square = CAG.rectangle({center: center, radius: (SWITCH_CENTER_Y_SPACING / 2) + radius});
      borderSquares.push(square);
    }
  }

  return hull(borderSquares);
}

function switchPlateLeftHand(opts={}) {
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
    columnOffsets: [],
    rowOffsets: [0, 6],
  });

  // Layout initial relative switch positions for primary matrix (required for hull calculation).
  connectSwitchesInDescriptorMatrix(primaryMatrix, {center: true});

  // Set up connection from thumb matrix to primary matrix.
  var thumbMatrixParentRow = primaryMatrix[primaryMatrix.length - 2];
  var thumbMatrixParent = thumbMatrixParentRow[thumbMatrixParentRow.length - 1];
  thumbMatrix[0][0].parentObject = thumbMatrixParent.keySwitch;
  thumbMatrix[0][0].parentConnector = new CSG.Connector([-4, SWITCH_CENTER_Y_SPACING + 3, 0], [0, 0, 1], [0, 1, 0]);

  // Layout initial relative switch positions for thumb matrix (required for hull calculation).
  connectSwitchesInDescriptorMatrix(thumbMatrix, {center: true});

  var exteriorHullSwitchRadius = 10;
  var interiorHullSwitchRadius = 3;
  var primaryExteriorHullOffsets = {bottom: -25, top: 5};
  var primaryInteriorHullOffsets = {bottom: -20};

  var primaryExteriorHull = hullForMatrix(primaryMatrix, {radius: exteriorHullSwitchRadius, offset: primaryExteriorHullOffsets});
  var primaryExteriorBounds = primaryExteriorHull.getBounds();
  for (var i = 0; i < primaryExteriorHull.sides.length; ++i) {
    var side = primaryExteriorHull.sides[i];
    if (side.vertex0.pos.x == primaryExteriorBounds[1].x && side.vertex1.pos.x == primaryExteriorBounds[1].x) {
      side.vertex1.pos = new CSG.Vector2D(side.vertex1.pos.x, primaryExteriorBounds[1].y);
      var side2 = primaryExteriorHull.sides[i + 1];
      side2.vertex0.pos = new CSG.Vector2D(side2.vertex0.pos.x, primaryExteriorBounds[1].y);
      break;
    }
  }
  var primaryInteriorHull = hullForMatrix(primaryMatrix, {radius: interiorHullSwitchRadius, offset: primaryInteriorHullOffsets});
  var primaryInteriorBounds = primaryInteriorHull.getBounds();
  for (var i = 0; i < primaryInteriorHull.sides.length; ++i) {
    var side = primaryInteriorHull.sides[i];
    if (side.vertex0.pos.x == primaryInteriorBounds[1].x && side.vertex1.pos.x == primaryInteriorBounds[1].x) {
      side.vertex1.pos = new CSG.Vector2D(side.vertex1.pos.x, primaryInteriorBounds[1].y);
      var side2 = primaryInteriorHull.sides[i + 1];
      side2.vertex0.pos = new CSG.Vector2D(side2.vertex0.pos.x, primaryInteriorBounds[1].y);
      break;
    }
  }
  var primaryPlate = linear_extrude({height: SWITCH_PLATE_THICKNESS}, primaryExteriorHull);
  var primaryInteriorCutout = linear_extrude({height: SWITCH_PLATE_THICKNESS}, primaryInteriorHull);

  var thumbExteriorHull = hullForMatrix(thumbMatrix, {radius: exteriorHullSwitchRadius});
  var thumbInteriorHull = hullForMatrix(thumbMatrix, {radius: interiorHullSwitchRadius});
  var thumbPlate = linear_extrude({height: SWITCH_PLATE_THICKNESS}, thumbExteriorHull);
  var thumbInteriorCutout = linear_extrude({height: SWITCH_PLATE_THICKNESS}, thumbInteriorHull);

  // Connect primary matrix to primary switch plate.
  primaryMatrix[0][0].parentObject = primaryPlate;
  primaryMatrix[0][0].parentObjectConnectorName = "primarySwitchPlateConnector";
  primaryPlate.properties.primarySwitchPlateConnector = new CSG.Connector(
    primaryMatrix[0][0].keySwitch.properties.center.point,
    [0, 0, 1],
    [0, 1, 0]
  );
  // These two points are intentionally identical.
  primaryMatrix[0][0].parentConnector = primaryPlate.properties.primarySwitchPlateConnector;
  connectSwitchesInDescriptorMatrix(primaryMatrix, {center: true});

  // Build switch plates.
  var primaryMatrixDescriptor = {
    matrix: primaryMatrix,
    plate: primaryPlate,
    cutout: primaryInteriorCutout,
  };
  var thumbMatrixDescriptor = {
    matrix: thumbMatrix,
    plate: thumbPlate,
    cutout: thumbInteriorCutout,
  };
  var matrixDescriptors = [primaryMatrixDescriptor, thumbMatrixDescriptor];
  for (var m = 0; m < matrixDescriptors.length; ++m) {
    var matrixDescriptor = matrixDescriptors[m];
    var switches = null;
    var keyCaps = null;
    for (var i = 0; i < matrixDescriptor.matrix.length; ++i) {
      var row = matrixDescriptor.matrix[i];
      for (var j = 0; j < row.length; ++j) {
        if (row[j].present) {
          switches = switches ? switches.union(row[j].keySwitch) : row[j].keySwitch;
          keyCaps = keyCaps ? keyCaps.union(row[j].cap) : row[j].cap;
        }
      }
    }
    matrixDescriptor.switches = switches.translate([0, 0, -switches.getBounds()[0].z]);
    matrixDescriptor.keyCaps = keyCaps.translate([0, 0, -switches.getBounds()[0].z + matrixDescriptor.switches.getBounds()[1].z]);
  }

  // Connect thumb switch plate to thumb matrix.
  var thumbMatrixRotation = -12;
  thumbMatrixDescriptor.plate.properties.thumbMatrixConnector = new CSG.Connector(
    thumbMatrix[0][0].keySwitch.properties.center.point,
    [0, 0, 1],
    [0, 1, 0]
  );
  // Adjust the plate last so that we don't use the updated property
  // when adjusting the other plate derivatives.
  // While the space is at a different Z coordinate, the two connectors
  // used have identical Z coordinates, so the transformation is sound.
  var thumbPlateProperties = ["cutout", "switches", "keyCaps", "plate"];
  for (var i = 0; i < thumbPlateProperties.length; ++i) {
    var property = thumbPlateProperties[i];
    thumbMatrixDescriptor[property] = thumbMatrixDescriptor[property].connectTo(
      thumbMatrixDescriptor.plate.properties.thumbMatrixConnector,
      thumbMatrix[0][0].keySwitch.properties.center,
      false,
      thumbMatrixRotation
    );
  }

  var fullPlate = primaryMatrixDescriptor.plate.union(thumbMatrixDescriptor.plate);
  var fullInteriorCutout = primaryMatrixDescriptor.cutout.union(thumbMatrixDescriptor.cutout);
  var fullSpacer = fullPlate.subtract(fullInteriorCutout).scale([1, 1, 2]);
  fullSpacer = fullSpacer.translate([0, 0, -fullSpacer.getBounds()[0].z]);

  // Add cutouts for HDMI connector.
  var spacerHeight = fullSpacer.getBounds()[1].z - fullSpacer.getBounds()[0].z;
  var hullSwitchRadiusDifferential = exteriorHullSwitchRadius - interiorHullSwitchRadius;
  var hdmiCutout = CSG.cube({radius: [15.4/2, (hullSwitchRadiusDifferential + primaryExteriorHullOffsets.top) / 2, spacerHeight / 2]});
  hdmiCutout = hdmiCutout.translate([0, 0, -hdmiCutout.getBounds()[0].z]);
  hdmiCutout.properties.topRightConnector = new CSG.Connector(
    [hdmiCutout.getBounds()[1].x, hdmiCutout.getBounds()[1].y, 0],
    [0, 0, 1],
    [0, 1, 0]
  );
  fullSpacer.properties.hdmiCutoutConnector = new CSG.Connector(
    [primaryMatrixDescriptor.plate.getBounds()[1].x - hullSwitchRadiusDifferential, primaryMatrixDescriptor.plate.getBounds()[1].y, 0],
    [0, 0, 1],
    [0, 1, 0]
  );
  hdmiCutout = hdmiCutout.connectTo(
    hdmiCutout.properties.topRightConnector,
    fullSpacer.properties.hdmiCutoutConnector,
    false,
    0
  );

  var usbCutout = CSG.cube({radius: [8.1/2, (hullSwitchRadiusDifferential + primaryExteriorHullOffsets.top + 1.5) / 2, spacerHeight / 2]});
  usbCutout = usbCutout.translate([0, 0, -usbCutout.getBounds()[0].z]);
  usbCutout.properties.topCenterConnector = new CSG.Connector(
    [0, usbCutout.getBounds()[1].y, 0],
    [0, 0, 1],
    [0, 1, 0]
  );
  var usbCutoutPlateTopSide = null;
  for (var i = 0; i < primaryExteriorHull.sides.length; ++i) {
    var side = primaryExteriorHull.sides[i];
    if (side.vertex0.pos.x == primaryExteriorBounds[0].x && side.vertex1.pos.x == primaryExteriorBounds[0].x) {
      usbCutoutPlateTopSide = primaryExteriorHull.sides[i - 1];
      break;
    }
  }
  var usbCutoutAngle = Math.asin(
    (usbCutoutPlateTopSide.vertex0.pos.y - usbCutoutPlateTopSide.vertex1.pos.y) / usbCutoutPlateTopSide.length()
  ) * (180 / Math.PI);
  var usbCutoutTopSide3D = CSG.Line3D.fromPoints(usbCutoutPlateTopSide.vertex0.pos.toVector3D(0), usbCutoutPlateTopSide.vertex1.pos.toVector3D(0));
  fullSpacer.properties.usbCutoutConnector = new CSG.Connector(
    usbCutoutTopSide3D.closestPointOnLine(primaryMatrix[0][1].keySwitch.getBoundsCenter()),
    [0, 0, 1],
    [0, 1, 0]
  );
  usbCutout = usbCutout.connectTo(
    usbCutout.properties.topCenterConnector,
    fullSpacer.properties.usbCutoutConnector,
    false,
    usbCutoutAngle
  );

  fullSpacer = fullSpacer.subtract(hdmiCutout).subtract(usbCutout);
  var switchPlate = fullPlate.subtract(primaryMatrixDescriptor.switches.union(thumbMatrixDescriptor.switches));
  var keyCaps = primaryMatrixDescriptor.keyCaps.union(thumbMatrixDescriptor.keyCaps);

  var result = switchPlate.translate([0, 0, fullSpacer.getBounds()[1].z]).union(fullSpacer)
  if (opts.displayKeyCapsForDebugging) {
    result = result.union(keyCaps);
  }
  return result;
}

function main(params) {
  installLibraryExtensions();

  var plateParams = {};
  var plateParamNames = [
    "displayKeyCapsForDebugging",
  ];
  for (var i = 0; i < plateParamNames.length; ++i) {
    plateParams[plateParamNames[i]] = params[plateParamNames[i]];
  }

  var result = switchPlateLeftHand(plateParams);

  if (params.center) {
    result = result.center('x', 'y');
  }

  if (params.displayDebuggingCoordinateLabels) {
    var textVectors = [
      vector_text(-130, 0, "-x"),
      vector_text(0, -100, "-y"),
      vector_text(90, 0, "x"),
      vector_text(0, 100, "y"),
    ];
    for (var h = 0; h < textVectors.length; ++h) {
      for (var i = 0; i < textVectors[h].length; ++i) {
        result = result.union(
          rectangular_extrude(textVectors[h][i], {w: 2, h: 1})
        )
      }
    }
  }

  return result;
}

