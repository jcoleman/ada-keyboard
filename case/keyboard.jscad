include("constants.jscad");
include("switch_matrix.jscad");
include("csg_dependency_graph.jscad");

class _Keyboard {
  constructor(opts={
    displayKeyCapsForDebugging: false,
    addCutoutForHDMIConnector: true,
    addCutoutForUSBConnector: true,
  }) {
    this._buildSwitchMatrices();

    this.csgDependencyTree = new CSGDependencyGraph();

    var plateCSG = this.primaryMatrix.plate.object.union(this.thumbMatrix.plate.object);
    var cutoutCSG = this.primaryMatrix.cutout.object.union(this.thumbMatrix.cutout.object);
    var switchHolesCSG = this.primaryMatrix.switchHoles.object.union(this.thumbMatrix.switchHoles.object);
    var spacerCSG = plateCSG.subtract(cutoutCSG);
    var switchPlateCSG = plateCSG.subtract(switchHolesCSG);

    this.switchPlate = this.csgDependencyTree.nodeFor(switchPlateCSG);

    var spacerAnchorCenter = spacerCSG.properties["primaryMatrix-anchorSwitch"].point;
    spacerCSG.properties["switchPlate-primaryMatrix-anchorSwitch"] = new CSG.Connector(
      [spacerAnchorCenter.x, spacerAnchorCenter.y, spacerAnchorCenter.z - SWITCH_PLATE_THICKNESS],
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

    this.csgDependencyTree.resolve();
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
