include("constants.js");

keyCap = function() {
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
switchHole = function(opts={thickness: SWITCH_PLATE_THICKNESS}) {
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
