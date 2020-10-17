include("constants.js");
include("switch_matrix.js");
include("csg_dependency_graph.js");

class CombinedKeyboard {
  constructor(opts={
    displayKeyCapsForDebugging: false,
    addCutoutForUSBConnector: true,
  }) {
    this.displayKeyCapsForDebugging = opts.displayKeyCapsForDebugging;
    this.addCutoutForUSBConnector = opts.addCutoutForUSBConnector;
    this.renderedPart = opts.renderedPart;

    this._buildSwitchMatrices();

    this.csgDependencyTree = new CSGLayoutDependencyGraph();
    this.combiningGraph = new CSGCombinationDependencyGraph();

    var primarySwitchPlateCSG = this.primaryMatrix.plate.object.subtract(this.primaryMatrix.switchHoles.object);
    var thumbSwitchPlateCSG = this.thumbMatrix.plate.object.subtract(this.thumbMatrix.switchHoles.object);

    var switchPlateCSG = primarySwitchPlateCSG.union(thumbSwitchPlateCSG);

    this.switchPlate = this.csgDependencyTree.nodeFor(switchPlateCSG);
    this.combiningGraph.nodeFor(this.switchPlate, {wrapExistingNode: true});

    if (this.displayKeyCapsForDebugging) {
      this._addKeycaps();
    }
  }

  buildCSG() {
    // return this.primaryMatrix.switchHoles.object.union(this.thumbMatrix.switchHoles.object);
    // We can't resolve the combination graph until after the layout graph is finalized.
    this.csgDependencyTree.resolve();
this._connectionLine();
    this.combiningGraph.resolve();

    const combinedSwitchPart = this.combiningGraph.nodeFor(this.switchPlate, {wrapExistingNode: true});

    return combinedSwitchPart.object;
  }

  _addKeycaps() {
    var keycapsCSG = this.primaryMatrix.keycaps.object.union(this.thumbMatrix.keycaps.object);
    this.keycaps = this.csgDependencyTree.nodeFor(keycapsCSG);

    this.csgDependencyTree.addConnection("keycaps-to-switchPlate", {
      parent: [this.switchPlate, "primaryMatrix-anchorSwitch"],
      child: [this.keycaps, "primaryMatrix-anchorSwitch"],
      mirror: false,
      rotationFromNormal: 0,
    });

    this.combiningGraph.addConnection("keycaps-to-switchPlate", {
      parent: this.combiningGraph.nodeFor(this.keycaps, {wrapExistingNode: true}),
      child: this.combiningGraph.nodeFor(this.switchPlate, {wrapExistingNode: true}),
      operation: "union",
    });
  }

  _buildSwitchMatrices() {
    var csgDependencyTree = new CSGLayoutDependencyGraph();

    var primarySwitchMatrix = new SwitchMatrix({
      name: "primary",
      placementMatrix: [
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [1, 1, 1, 1, 1, 1],
        [0, 0, 1, 1, 1, 0],
      ],
      // Should eventually be 2, 3 for the middle finger home row position
      // but currently using the same switch location as was used in revision 1
      // to connect the thumb matrix so that we ensure identical output for now.
      anchorSwitchCoordinates: [3, 5],
      columnOffsets: [0, -4, 14, 5, -6, -5],
      rowOffsets: [],
    });

    this.primaryMatrix = new SwitchMatrixComponents({
      csgDependencyTree: csgDependencyTree,
      switchMatrix: primarySwitchMatrix,
      caseBaseRadiiFromSwitchCenters: {
        interior: 0,
        exterior: 4,
      },
    });

    primarySwitchMatrix.matrix[0][0].keySwitch.object = primarySwitchMatrix.matrix[0][0].keySwitch.object.rotateY(-8);
    primarySwitchMatrix.csgDependencyTree.resolve();

    var thumbSwitchMatrix = new SwitchMatrix({
      name: "thumb",
      placementMatrix: [
        [1, 1],
        [1, 1],
      ],
      columnOffsets: [],
      rowOffsets: [0, 6],
    });

    this.thumbMatrix = new SwitchMatrixComponents({
      csgDependencyTree: csgDependencyTree,
      switchMatrix: thumbSwitchMatrix,
      caseBaseRadiiFromSwitchCenters: {
        interior: 0,
        exterior: 4,
      },
    });

    // TODO: Comment
    thumbSwitchMatrix.anchorSwitch.properties.anchorSwitchFromPrimaryMatrix = new CSG.Connector(
      [-4, SWITCH_CENTER_Y_SPACING + 3, thumbSwitchMatrix.anchorSwitch.properties.center.point.z],
      [0, 0, 1],
      [0, 1, 0]
    );
    thumbSwitchMatrix.csgDependencyTree.addConnection("fillthisin", {
      parent: [thumbSwitchMatrix.csgDependencyTree.nodeFor(primarySwitchMatrix.anchorDescriptor.keySwitch, {wrapExistingNode: true}), "center"],
      child: [thumbSwitchMatrix.anchorDescriptor.keySwitch, "anchorSwitchFromPrimaryMatrix"],
      mirror: false,
      rotationFromNormal: THUMB_MATRIX_ROTATION,
    });

    thumbSwitchMatrix.csgDependencyTree.resolve();
    var thumbAnchorSwitch = thumbSwitchMatrix.matrix[0][0].keySwitch;
    // TODO: Comment
    // Args: (rotationCenter, rotationAxis, degrees)
    var thumbRotationMatrix = CSG.Matrix4x4.rotation(
      thumbAnchorSwitch.object.properties.center.point,
      [0, 1, 0],
      8 * 2
    );
    thumbAnchorSwitch.object = thumbAnchorSwitch.object.transform(thumbRotationMatrix);

    // TODO: We "have to" rotate the key switches before building
    // the hulls if we want to be able to reference the switches
    // coordinates in final 3D space. However that presents a bit
    // of a catch-22 because the hulling algorithm is in 2D, and
    // the extrusion results in an un-rotated object.
    // Possibilities:
    // - Generate hulls and the _also_ rotate switches separately
    //   just to get reference coordinates.
    // - Write our own 3D hulling algorithm (is there any values
    //   in being able to do that to combinations of switches
    //   from multiple matrices (at different rotations even)?
    //   Or is that actually just going to create more work?
    //   To put it another way: do we need to generate two
    //   independent switch plates or not (it's possible that
    //   the answer will seem to be "yes" for the purposes of
    //   cutting out plates and "no" for the purposes of building
    //   the rest of the case). Addendum: We can't "just" rotate both
    //   independently that easily since they aren't the same size and
    //   won't share the same axis (I assume).
    //
    //  Conclusion: We should probably layout the switches in the
    //  normal plane and build hulls (with z=0). Then with the hull
    //  having a connection to one of the switches we can rotate the
    //  parent switch, and re-layour the switches in the rotated plane.
    //  Then the hull (or plate?) will be layed out to match given
    //  the connection. After defining the cut line between the two
    //  matrices, we can modify the hull (if not using a custom
    //  algorithm) by substracting a shape from the cut line out
    //  from each matrix. Then the two can be stitched back together
    //  into a combined shape, but with two switch plates.

    // csgDependencyTree.addConnection("thumbMatrix-plate", {
    //   parent: [this.primaryMatrix.plate, "primaryMatrix-anchorSwitch"],
    //   child: [this.thumbMatrix.plate, "anchorSwitchFromPrimaryMatrix"],
    //   mirror: false,
    //   rotationFromNormal: THUMB_MATRIX_ROTATION,
    // });

    // this._connectionLine();

    csgDependencyTree.resolve();
  }

  _connectionLine() {
    // return;
    var topLeftThumbSwitchHole = this.thumbMatrix.switchMatrix.matrix[0][0].keySwitch.object;
    var thumbSwitchPoints = [
      topLeftThumbSwitchHole.properties.bottomLeft,
      topLeftThumbSwitchHole.properties.topLeft,
      topLeftThumbSwitchHole.properties.topRight,
    ];
    console.log("bottomLeft", topLeftThumbSwitchHole.properties.bottomLeft);
    console.log("topLeft", topLeftThumbSwitchHole.properties.topLeft);
    console.log("topRight", topLeftThumbSwitchHole.properties.topRight);
    var self = this;
    var primaryMatrix = this.primaryMatrix.switchMatrix.matrix;
    var blob = new CSG();
    thumbSwitchPoints.forEach(function(p) {
      var minDistance = null;
      var minDistanceSwitch = null;
      var minDistancePoint = null;
      var minDistanceMidPoint = null;
      // console.log("point:", p);
      // d = ((x2 - x1)2 + (y2 - y1)2 + (z2 - z1)2)1/2
      for (var row = 0; row < primaryMatrix.length; ++row) {
        for (var col = 0; col < primaryMatrix[row].length; ++col) {
          if (primaryMatrix[row][col].present) {
            var sprop = primaryMatrix[row][col].keySwitch.object.properties;
            [
              sprop.bottomRight,
              sprop.topRight,
              sprop.bottomLeft,
            ].forEach(function(p2) {
              // console.log("v", primaryMatrix[row][col]);
              // var p2 = primaryMatrix[row][col].keySwitch.object.properties.center.point;
              var d = Math.sqrt(Math.pow(p2.x - p.x, 2) + Math.pow(p2.y - p.y, 2) + Math.pow(p2.z - p.z, 2));
              // console.log("distance from", p2, "at", row, col, "is", d);
              if (minDistance === null || d < minDistance) {
                minDistance = d;
                minDistanceSwitch = [row, col];
                minDistancePoint = p2;
                // minDistanceMidPoint = p;
                minDistanceMidPoint = [(p.x + p2.x) / 2, (p.y + p2.y) / 2, (p.z + p2.z) / 2];
              }
            });
          }
        }
      };
      console.log("min distance switch:", minDistanceSwitch, "p", p, "midpoint", minDistanceMidPoint, "p2", minDistancePoint);
      var b = CSG.cube({center: minDistanceMidPoint, radius: [3, 3, 3]}).setColor([0,1,0]);
      // var b2 = CSG.cube({center: minDistancePoint, radius: [3, 3, 3]}).setColor([0,0,1]);
      blob = blob.union(b);
      // blob = blob.union(b2);
    });

    blob.properties["primaryMatrix-anchorSwitch"] = new CSG.Connector(
      this.switchPlate.object.properties["primaryMatrix-anchorSwitch"].point,
      [0, 0, 1],
      [0, 1, 0]
    );

    this.csgDependencyTree.addConnection("blobs-to-switchPlate", {
      parent: [this.switchPlate, "primaryMatrix-anchorSwitch"],
      child: [this.csgDependencyTree.nodeFor(blob), "primaryMatrix-anchorSwitch"],
      mirror: false,
      rotationFromNormal: 0,
    });
    console.log("node for", blob);
    this.combiningGraph.addConnection("blob-to-switchPlate", {
      child: this.combiningGraph.nodeFor(this.switchPlate, {wrapExistingNode: true}),
      parent: this.combiningGraph.nodeFor(this.csgDependencyTree.nodeFor(blob), {wrapExistingNode: true}),
      operation: "union",
    });
  }

  // Determining linkage between two matrix plates:
  // - For each of the [bottom left, top left, top right]
  //   coordinates of the top left thumb matrix switch, do:
  //   - Find the closest switch.
  //   - Find the closest point/corner? on that switch.
  //   - Calculate the halfway point between the two points.
}

var moduleExports;
if (typeof(self) == "object" && typeof(exports) == "undefined") {
  // Shim since OpenJSCAD's `include` eval's the code and classes
  // inside an eval scope are not defined outside of that scope.
  moduleExports = self;
} else {
  moduleExports = exports;
}
moduleExports.CombinedKeyboard = CombinedKeyboard;
