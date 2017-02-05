include("constants.jscad");
include("left_hand_switch_layout.jscad");
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

    this.leftHandSwitchLayout = new LeftHandSwitchLayout();

    this.csgDependencyTree = new CSGDependencyGraph();

    this.switchPlate = this.csgDependencyTree.nodeFor(this.leftHandSwitchLayout.switchPlate);

    var spacer = this.leftHandSwitchLayout.spacer;
    var spacerAnchorCenter = spacer.properties["primaryMatrix-anchorSwitch"].point;
    spacer.properties["switchPlate-primaryMatrix-anchorSwitch"] = new CSG.Connector(
      [spacerAnchorCenter.x, spacerAnchorCenter.y, spacerAnchorCenter.z - SWITCH_PLATE_THICKNESS],
      [0, 0, 1],
      [0, 1, 0]
    );
    this.spacer = this.csgDependencyTree.nodeFor(spacer);

    this.csgDependencyTree.addConnection("spacer-to-switchPlate", {
      parent: [this.switchPlate, "primaryMatrix-anchorSwitch"],
      child: [this.spacer, "switchPlate-primaryMatrix-anchorSwitch"],
      mirror: false,
      rotationFromNormal: 0,
    });

    this.csgDependencyTree.resolve();
  }

  get result() {
    return this.spacer.union(this.switchPlate);
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
Keyboard = _Keyboard;
