include("constants.jscad");
include("switch_matrix.jscad");
include("csg_dependency_graph.jscad");

class _Keyboard {
  constructor(opts={
    displayKeyCapsForDebugging: false,
    addCutoutForHDMIConnector: true,
    addCutoutForUSBConnector: true,
  }) {
    this.displayKeyCapsForDebugging = opts.displayKeyCapsForDebugging;
    this.addCutoutForHDMIConnector = opts.addCutoutForHDMIConnector;
    this.addCutoutForUSBConnector = opts.addCutoutForUSBConnector;

    this._buildSwitchMatrices();

    this.csgDependencyTree = new CSGDependencyGraph();

    var plateCSG = this.primaryMatrix.plate.object.union(this.thumbMatrix.plate.object);
    var cutoutCSG = this.primaryMatrix.cutout.object.union(this.thumbMatrix.cutout.object);
    var switchHolesCSG = this.primaryMatrix.switchHoles.object.union(this.thumbMatrix.switchHoles.object);
    var spacerCSG = plateCSG.subtract(cutoutCSG);
    var switchPlateCSG = plateCSG.subtract(switchHolesCSG);

    this.switchPlate = this.csgDependencyTree.nodeFor(switchPlateCSG);
    this._addSpacer(spacerCSG);

    if (this.displayKeyCapsForDebugging) {
      this._addKeycaps();
    }

    if (this.addCutoutForHDMIConnector) {
      this._addCutoutForHDMIConnector();
    }

    if (this.addCutoutForUSBConnector) {
      this._addCutoutForUSBConnector();
    }
  }

  buildCSG() {
    this.csgDependencyTree.resolve();

    var csg = this.spacer.object.union(this.switchPlate.object);

    if (this.displayKeyCapsForDebugging) {
      csg = csg.union(this.keycaps.object);
    }

    if (this.addCutoutForHDMIConnector) {
      csg = csg.subtract(this.hdmiCutout.object);
    }

    if (this.addCutoutForUSBConnector) {
      csg = csg.subtract(this.usbCutout.object);
    }

    return csg;
  }

  _addSpacer(spacerCSG) {
    var spacerAnchorCenter = spacerCSG.properties["primaryMatrix-anchorSwitch"].point;
    spacerCSG.properties["switchPlate-primaryMatrix-anchorSwitch"] = new CSG.Connector(
      [spacerAnchorCenter.x, spacerAnchorCenter.y, spacerAnchorCenter.z + SWITCH_PLATE_THICKNESS],
      [0, 0, 1],
      [0, 1, 0]
    );
    this.spacer = this.csgDependencyTree.nodeFor(spacerCSG);

    this.csgDependencyTree.addConnection("spacer-to-switchPlate", {
      parent: [this.switchPlate, "primaryMatrix-anchorSwitch"],
      child: [this.spacer, "switchPlate-primaryMatrix-anchorSwitch"],
      mirror: false,
      rotationFromNormal: 0,
    });
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
  }

  _addCutoutForHDMIConnector() {
    var spacerBounds = this.spacer.object.getBounds();
    var spacerHeight = spacerBounds[1].z - spacerBounds[0].z;
    var depth = this.primaryMatrix.switchMatrix.spacerDepth + this.primaryMatrix.switchMatrix.caseAdditionalRadiiOffsets.exterior.top;
    var hdmiCutoutCSG = CSG.cube({radius: [15.4/2, depth / 2, spacerHeight / 2]});
    var hdmiCutoutBounds = hdmiCutoutCSG.getBounds();
    hdmiCutoutCSG.properties.hdmiCutoutBottomRight = new CSG.Connector(
      [hdmiCutoutBounds[1].x, hdmiCutoutBounds[1].y, hdmiCutoutBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );
    var x = this.primaryMatrix.cutout.object.getBounds()[1].x;
    this.spacer.object.properties["spacer-hdmiCutoutBottomRight"] = new CSG.Connector(
      [x, spacerBounds[1].y, spacerBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );
    this.hdmiCutout = this.csgDependencyTree.nodeFor(hdmiCutoutCSG);

    this.csgDependencyTree.addConnection("hdmiCutout-to-spacer", {
      parent: [this.spacer, "spacer-hdmiCutoutBottomRight"],
      child: [this.hdmiCutout, "hdmiCutoutBottomRight"],
      mirror: false,
      rotationFromNormal: 0,
    });
  }

  _addCutoutForUSBConnector() {
    var spacerBounds = this.spacer.object.getBounds();
    var spacerHeight = spacerBounds[1].z - spacerBounds[0].z;
    var depth = this.primaryMatrix.switchMatrix.spacerDepth + this.primaryMatrix.switchMatrix.caseAdditionalRadiiOffsets.exterior.top + 1.5;
    var usbCutoutCSG = CSG.cube({radius: [8.1/2, depth / 2, spacerHeight / 2]});
    usbCutoutCSG = usbCutoutCSG.translate([0, 0, -usbCutoutCSG.getBounds()[0].z]);
    var usbCutoutBounds = usbCutoutCSG.getBounds();
    usbCutoutCSG.properties.usbCutoutBottomRight = new CSG.Connector(
      [0, usbCutoutBounds[1].y, usbCutoutBounds[0].z],
      [0, 0, 1],
      [0, 1, 0]
    );

    var usbCutoutPlateTopSide = null;
    var primaryExteriorHull = this.primaryMatrix.switchMatrix._exteriorHull;
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
    var usbCutoutTopSide3D = CSG.Line3D.fromPoints(
      usbCutoutPlateTopSide.vertex0.pos.toVector3D(spacerBounds[0].z),
      usbCutoutPlateTopSide.vertex1.pos.toVector3D(spacerBounds[0].z)
    );

    var parentSwitch = this.primaryMatrix.switchMatrix.matrix[0][1].keySwitch.object;
    this.spacer.object.properties["spacer-usbCutoutBottomRight"] = new CSG.Connector(
      usbCutoutTopSide3D.closestPointOnLine(parentSwitch.getBoundsCenter()),
      [0, 0, 1],
      [0, 1, 0]
    );

    this.usbCutout = this.csgDependencyTree.nodeFor(usbCutoutCSG);

    this.csgDependencyTree.addConnection("usbCutout-to-spacer", {
      parent: [this.spacer, "spacer-usbCutoutBottomRight"],
      child: [this.usbCutout, "usbCutoutBottomRight"],
      mirror: false,
      rotationFromNormal: usbCutoutAngle,
    });
  }

  _buildSwitchMatrices() {
    var csgDependencyTree = new CSGDependencyGraph();

    this.primaryMatrix = new SwitchMatrix({
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
      caseBaseRadiiFromSwitchCenters: {
        interior: 3,
        exterior: 10,
      },
      caseAdditionalRadiiOffsets: {
        exterior: {bottom: -25, top: 5},
        interior: {bottom: -20},
      },
      squareTopRightCorner: true,
    }).switchMatrixComponentsForDependencyTree(csgDependencyTree);

    this.thumbMatrix = new SwitchMatrix({
      name: "thumb",
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
    }).switchMatrixComponentsForDependencyTree(csgDependencyTree);

    this.thumbMatrix.plate.object.properties.anchorSwitchFromPrimaryMatrix = new CSG.Connector(
      [-4, SWITCH_CENTER_Y_SPACING + 3, this.thumbMatrix.plate.object.properties["thumbMatrix-anchorSwitch"].point.z],
      [0, 0, 1],
      [0, 1, 0]
    );
    csgDependencyTree.addConnection("thumbMatrix-plate", {
      parent: [this.primaryMatrix.plate, "primaryMatrix-anchorSwitch"],
      child: [this.thumbMatrix.plate, "anchorSwitchFromPrimaryMatrix"],
      mirror: false,
      rotationFromNormal: -12,
    });

    csgDependencyTree.resolve();
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
Keyboard = _Keyboard;
