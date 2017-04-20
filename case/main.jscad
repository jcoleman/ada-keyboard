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
      name: "renderedPart",
      type: "choice",
      values: ["switchPlate", "base", "full"],
      captions: ["Switch Plate", "Base", "Full"],
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

function main(params) {
  include("extensions/csg.js");
  include("extensions/cag.js");

  var plateParams = {};
  var plateParamNames = [
    "displayKeyCapsForDebugging",
    "addCutoutForHDMIConnector",
    "addCutoutForUSBConnector",
    "renderedPart",
  ];
  for (var i = 0; i < plateParamNames.length; ++i) {
    plateParams[plateParamNames[i]] = params[plateParamNames[i]];
  }

  var keyboard = new Keyboard(plateParams);
  var result = keyboard.buildCSG();

  if (params.hand == "right") {
    result = result.mirroredX();
  }

  if (params.center) {
    result = result.center('x', 'y');

    var bounds = result.getBounds();
    result = result.translate([0, 0, -bounds[0].z]);
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

