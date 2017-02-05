include("constants.jscad");
include("switch_matrix.jscad");
include("csg_dependency_graph.jscad");

class _LeftHandSwitchLayout {
  constructor() {
    this.csgDependencyTree = new CSGDependencyGraph();

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
    }).switchMatrixComponentsForDependencyTree(this.csgDependencyTree);

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
    }).switchMatrixComponentsForDependencyTree(this.csgDependencyTree);

    this.thumbMatrix.plate.object.properties.anchorSwitchFromPrimaryMatrix = new CSG.Connector(
      [-4, SWITCH_CENTER_Y_SPACING + 3, this.thumbMatrix.plate.object.properties["thumbMatrix-anchorSwitch"].point.z],
      [0, 0, 1],
      [0, 1, 0]
    );
    this.csgDependencyTree.addConnection("thumbMatrix-plate", {
      parent: [this.primaryMatrix.plate, "primaryMatrix-anchorSwitch"],
      child: [this.thumbMatrix.plate, "anchorSwitchFromPrimaryMatrix"],
      mirror: false,
      rotationFromNormal: -12,
    });

    this.csgDependencyTree.resolve();
  }

  get plate() {
    if (!this._plate) {
      this._plate = this.primaryMatrix.plate.object.union(this.thumbMatrix.plate.object);
    }
    return this._plate;
  }

  get cutout() {
    if (!this._cutout) {
      this._cutout = this.primaryMatrix.cutout.object.union(this.thumbMatrix.cutout.object);
    }
    return this._cutout;
  }

  get switchHoles() {
    if (!this._switchHoles) {
      this._switchHoles = this.primaryMatrix.switchHoles.object.union(this.thumbMatrix.switchHoles.object);
    }
    return this._switchHoles;
  }

  get spacer() {
    if (!this._spacer) {
      this._spacer = this.plate.subtract(this.cutout);
    }
    return this._spacer;
  }

  get switchPlate() {
    if (!this._switchPlate) {
      this._switchPlate = this.plate.subtract(this.switchHoles);
    }
    return this._switchPlate;
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
LeftHandSwitchLayout = _LeftHandSwitchLayout;
