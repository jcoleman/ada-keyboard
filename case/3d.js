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
  var switches = [];

  var primaryKeyMatrix = [
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [1, 1, 1, 1, 1, 1],
    [0, 0, 1, 1, 1, 1],
  ];
  var columnOffsets = [-18, -19, -5, 0, -6, -11];

  for (var row = 0; row < primaryKeyMatrix.length; ++row) {
    var baseY = -100 + (row * SWITCH_CENTER_Y_SPACING);
    for (var col = 0; col < primaryKeyMatrix[row].length; ++col) {
      if (primaryKeyMatrix[row][col] == 1) {
        var baseX = -100 + (col * SWITCH_CENTER_X_SPACING);
        var keySwitch = switchHole();
        var switchCenter = [baseX, baseY - columnOffsets[col], 0];
        var plateConnector = new CSG.Connector(switchCenter, [0, 0, 1], [0, 1, 0]);
        plate.properties["switch_" + row + "_" + col] = plateConnector;
        keySwitch = keySwitch.connectTo(keySwitch.properties.center, plateConnector, true, 0);
        switches.push(keySwitch);
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

