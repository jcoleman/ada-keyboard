include("switch.jscad");
include("switch_matrix.jscad");
include("csg_dependency_graph.jscad");

function getParameterDefinitions() {
  return [
    {
      name: "hand",
      type: "choice",
      values: ["left", "right"],
      captions: ["Left hand", "Right hand"],
      caption: "Half to render",
      initial: "left",
    },
    {
      name: "part",
      type: "choice",
      values: ["switchPlate", "base"],
      captions: ["Switch Plate", "Base"],
      caption: "Part to render",
      initial: "switchPlate",
    },
    {
      name: "center",
      type: "checkbox",
      checked: "checked",
      caption: "Center the result",
    },
    {
      name: "addCutoutForHDMIConnector",
      type: "checkbox",
      checked: "checked",
      caption: "Add cutout for the HDMI connector (to connect the other half)",
    },
    {
      name: "addCutoutForUSBConnector",
      type: "checkbox",
      checked: "checked",
      caption: "Add cutout for the USB connector",
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

function switchPlateLeftHand(opts={}) {
  var primaryMatrix = new SwitchMatrix({
    placementMatrix: [
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [1, 1, 1, 1, 1, 1],
      [0, 0, 1, 1, 1, 0],
    ],
    columnOffsets: [0, -4, 14, 5, -6, -5],
    rowOffsets: [],
    caseBaseRadiiFromSwitchCenters: {
      interior: 3,
      exterior: 10,
    },
    caseAdditionalRadiiOffsets: {
      exterior: {bottom: -25, top: 5},
      interior: {bottom: -20},
    },
    squareTopRightCorner: true,
  });

  var thumbMatrix = new SwitchMatrix({
    placementMatrix: [
      [1, 1],
      [1, 1],
    ],
    columnOffsets: [],
    rowOffsets: [0, 6],
    caseBaseRadiiFromSwitchCenters: {
      interior: 3,
      exterior: 10,
    },
  });

  // Layout initial relative switch positions for primary matrix (required for hull calculation).
  primaryMatrix.connectSwitches();

  // Set up connection from thumb matrix to primary matrix.
  var thumbMatrixParentRow = primaryMatrix.matrix[primaryMatrix.matrix.length - 2];
  var thumbMatrixParent = thumbMatrixParentRow[thumbMatrixParentRow.length - 1];
  thumbMatrix.matrix[0][0].parentObject = thumbMatrixParent.keySwitch;
  thumbMatrix.matrix[0][0].parentConnector = new CSG.Connector([-4, SWITCH_CENTER_Y_SPACING + 3, 0], [0, 0, 1], [0, 1, 0]);

  // Layout initial relative switch positions for thumb matrix (required for hull calculation).
  thumbMatrix.connectSwitches();

  var primaryExteriorHull = primaryMatrix.exteriorHull();
  var primaryInteriorHull = primaryMatrix.interiorHull();
  var primaryPlate = primaryMatrix.plate();
  var primaryInteriorCutout = primaryMatrix.cutout();

  var thumbExteriorHull = thumbMatrix.exteriorHull();
  var thumbInteriorHull = thumbMatrix.interiorHull();
  var thumbPlate = thumbMatrix.plate();
  var thumbInteriorCutout = thumbMatrix.cutout();

  // Connect primary matrix to primary switch plate.
  primaryMatrix.matrix[0][0].parentObject = primaryPlate;
  primaryMatrix.matrix[0][0].parentObjectConnectorName = "primarySwitchPlateConnector";
  primaryPlate.properties.primarySwitchPlateConnector = new CSG.Connector(
    primaryMatrix.matrix[0][0].keySwitch.object.properties.center.point,
    [0, 0, 1],
    [0, 1, 0]
  );

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
    for (var i = 0; i < matrixDescriptor.matrix.matrix.length; ++i) {
      var row = matrixDescriptor.matrix.matrix[i];
      for (var j = 0; j < row.length; ++j) {
        if (row[j].present) {
          switches = switches ? switches.union(row[j].keySwitch.object) : row[j].keySwitch.object;
          keyCaps = keyCaps ? keyCaps.union(row[j].cap.object) : row[j].cap.object;
        }
      }
    }
    matrixDescriptor.switches = switches.translate([0, 0, -switches.getBounds()[0].z]);
    matrixDescriptor.keyCaps = keyCaps.translate([0, 0, -switches.getBounds()[0].z + matrixDescriptor.switches.getBounds()[1].z]);
  }

  // Connect thumb switch plate to thumb matrix.
  var thumbMatrixRotation = -12;
  thumbMatrixDescriptor.plate.properties.thumbMatrixConnector = new CSG.Connector(
    thumbMatrix.matrix[0][0].keySwitch.object.properties.center.point,
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
      thumbMatrix.matrix[0][0].keySwitch.object.properties.center,
      false,
      thumbMatrixRotation
    );
  }

  var fullPlate = primaryMatrixDescriptor.plate.union(thumbMatrixDescriptor.plate);
  var fullInteriorCutout = primaryMatrixDescriptor.cutout.union(thumbMatrixDescriptor.cutout);
  var fullSpacer = fullPlate.subtract(fullInteriorCutout).scale([1, 1, 2]);
  fullSpacer = fullSpacer.translate([0, 0, -fullSpacer.getBounds()[0].z]);

  var spacerHeight = fullSpacer.getBounds()[1].z - fullSpacer.getBounds()[0].z;
  var hullSwitchRadiusDifferential = primaryMatrix.spacerDepth;

  if (opts.addCutoutForHDMIConnector) {
    var hdmiCutout = CSG.cube({radius: [15.4/2, (hullSwitchRadiusDifferential + primaryMatrix.caseAdditionalRadiiOffsets.exterior.top) / 2, spacerHeight / 2]});
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

    fullSpacer = fullSpacer.subtract(hdmiCutout);
  }

  if (opts.addCutoutForUSBConnector) {
    var usbCutout = CSG.cube({radius: [8.1/2, (hullSwitchRadiusDifferential + primaryMatrix.caseAdditionalRadiiOffsets.exterior.top + 1.5) / 2, spacerHeight / 2]});
    usbCutout = usbCutout.translate([0, 0, -usbCutout.getBounds()[0].z]);
    usbCutout.properties.topCenterConnector = new CSG.Connector(
      [0, usbCutout.getBounds()[1].y, 0],
      [0, 0, 1],
      [0, 1, 0]
    );
    var usbCutoutPlateTopSide = null;
    var primaryExteriorBounds = primaryExteriorHull.getBounds();
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
      usbCutoutTopSide3D.closestPointOnLine(primaryMatrixDescriptor.matrix.matrix[0][1].keySwitch.object.getBoundsCenter()),
      [0, 0, 1],
      [0, 1, 0]
    );
    usbCutout = usbCutout.connectTo(
      usbCutout.properties.topCenterConnector,
      fullSpacer.properties.usbCutoutConnector,
      false,
      usbCutoutAngle
    );

    fullSpacer = fullSpacer.subtract(usbCutout);
  }

  var switchPlate = fullPlate.subtract(primaryMatrixDescriptor.switches.union(thumbMatrixDescriptor.switches));
  var keyCaps = primaryMatrixDescriptor.keyCaps.union(thumbMatrixDescriptor.keyCaps);

  var result = switchPlate.translate([0, 0, fullSpacer.getBounds()[1].z]).union(fullSpacer)
  if (opts.displayKeyCapsForDebugging) {
    result = result.union(keyCaps);
  }
  return result;
}

function main(params) {
  include("csg.js");

  var plateParams = {};
  var plateParamNames = [
    "displayKeyCapsForDebugging",
    "addCutoutForHDMIConnector",
    "addCutoutForUSBConnector",
  ];
  for (var i = 0; i < plateParamNames.length; ++i) {
    plateParams[plateParamNames[i]] = params[plateParamNames[i]];
  }

  var result = switchPlateLeftHand(plateParams);

  if (params.hand == "right") {
    result = result.mirroredX();
  }

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

