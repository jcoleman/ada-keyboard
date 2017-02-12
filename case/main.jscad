include("switch.jscad");
include("keyboard.jscad");
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
  var keyboard = new Keyboard();
  var fullSpacer = keyboard.spacer.object;
  var switchPlate = keyboard.switchPlate.object;

  var spacerHeight = fullSpacer.getBounds()[1].z - fullSpacer.getBounds()[0].z;
  var primaryMatrix = keyboard.primaryMatrix.switchMatrix;
  var hullSwitchRadiusDifferential = primaryMatrix.spacerDepth;
  var primaryMatrixCaseAdditionalHeadroom = primaryMatrix.caseAdditionalRadiiOffsets.exterior.top;
  if (opts.addCutoutForHDMIConnector) {
    var hdmiCutout = CSG.cube({radius: [15.4/2, (hullSwitchRadiusDifferential + primaryMatrixCaseAdditionalHeadroom) / 2, spacerHeight / 2]});
    var hdmiCutoutBounds = hdmiCutout.getBounds();
    hdmiCutout.properties.bottomRightConnector = new CSG.Connector(
      [hdmiCutoutBounds[1].x, hdmiCutoutBounds[1].y, hdmiCutoutBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );
    var fullSpacerBounds = fullSpacer.getBounds();
    var x = keyboard.primaryMatrix.cutout.object.getBounds()[1].x;
    fullSpacer.properties.hdmiCutoutConnector = new CSG.Connector(
      [x, fullSpacerBounds[1].y, fullSpacerBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );
    hdmiCutout = hdmiCutout.connectTo(
      hdmiCutout.properties.bottomRightConnector,
      fullSpacer.properties.hdmiCutoutConnector,
      false,
      0
    );

    fullSpacer = fullSpacer.subtract(hdmiCutout);
  }

  if (opts.addCutoutForUSBConnector) {
    var usbCutout = CSG.cube({radius: [8.1/2, (hullSwitchRadiusDifferential + primaryMatrixCaseAdditionalHeadroom + 1.5) / 2, spacerHeight / 2]});
    usbCutout = usbCutout.translate([0, 0, -usbCutout.getBounds()[0].z]);
    var usbCutoutBounds = usbCutout.getBounds();
    usbCutout.properties.bottomCenterConnector = new CSG.Connector(
      [0, usbCutoutBounds[1].y, usbCutoutBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );
    var usbCutoutPlateTopSide = null;
    var primaryExteriorHull = primaryMatrix._exteriorHull;
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
    var fullSpacerBounds = fullSpacer.getBounds();
    var usbCutoutTopSide3D = CSG.Line3D.fromPoints(
      usbCutoutPlateTopSide.vertex0.pos.toVector3D(fullSpacerBounds[0].z),
      usbCutoutPlateTopSide.vertex1.pos.toVector3D(fullSpacerBounds[0].z)
    );
    var parentSwitch = primaryMatrix.matrix[0][1].keySwitch.object;
    fullSpacer.properties.usbCutoutConnector = new CSG.Connector(
      usbCutoutTopSide3D.closestPointOnLine(parentSwitch.getBoundsCenter()),
      [0, 0, 1],
      [0, 1, 0]
    );
    usbCutout = usbCutout.connectTo(
      usbCutout.properties.bottomCenterConnector,
      fullSpacer.properties.usbCutoutConnector,
      false,
      usbCutoutAngle
    );

    fullSpacer = fullSpacer.subtract(usbCutout);
  }

  var result = switchPlate.translate([0, 0, fullSpacer.getBounds()[1].z]).union(fullSpacer)
  if (opts.displayKeyCapsForDebugging) {
    var keyCaps = primaryMatrixDescriptor.keyCaps.union(thumbMatrixDescriptor.keyCaps);
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

