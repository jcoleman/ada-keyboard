include("constants.jscad");
include("switch.jscad");
include("csg_dependency_graph.jscad");

class _SwitchMatrix {
  // Builds a matrix of key switch descriptors that are unconnected
  // but contain the information to be connected.
  // The first switch (at coordinates[0, 0]) will not have connecting
  // information.
  constructor(opts={
    name: "",
    placementMatrix: [[]],
    columnOffsets: [],
    rowOffsets: [],
    caseBaseRadiiFromSwitchCenters: {}, // E.g., {interior: 5, exterior, 10}
    caseAdditionalRadiiOffsets: {}, // E.g., {exterior: {bottom: -25, top: 5}}
    squareTopRightCorner: false,
    csgDependencyTree: null, // Optional override.
  }) {
    if (!Array.isArray(opts.placementMatrix) && opts.placementMatrix.length > 0) {
      throw new Error("Expected placement matrix to be array of at least length 1.");
    }
    if (!opts.placementMatrix.reduce(function(valid, row) {
      return valid && Array.isArray(row) && row.length == opts.placementMatrix[0].length && row.length > 0;
    }, true)) {
      throw new Error("Expected all rows in placement matrix to be arrays of the same length (and at least length 1).");
    }

    this.name = opts.name;
    this.placementMatrix = opts.placementMatrix;
    this.anchorSwitchCoordinates = opts.anchorSwitchCoordinates || [0, 0];
    this.columnOffsets = opts.columnOffsets;
    this.rowOffsets = opts.rowOffsets;
    this.caseBaseRadiiFromSwitchCenters = opts.caseBaseRadiiFromSwitchCenters;
    this.caseAdditionalRadiiOffsets = opts.caseAdditionalRadiiOffsets || {};
    this.squareTopRightCorner = opts.squareTopRightCorner;
    this.csgDependencyTree = opts.csgDependencyTree || new CSGDependencyGraph();
    this.matrix = [];

    for (var row = 0; row < this.placementMatrix.length; ++row) {
      var baseY = row * SWITCH_CENTER_Y_SPACING;

      this.matrix.push([]);
      for (var col = 0; col < this.placementMatrix[row].length; ++col) {
        var result = {
          keySwitch: this.csgDependencyTree.nodeFor(switchHole()),
          cap: this.csgDependencyTree.nodeFor(keyCap()),
        };

        result.keySwitch.name = "key" + String(row) + "x" + String(col);
        result.cap.name = "cap" + String(row) + "x" + String(col);
        this.csgDependencyTree.addConnection(this.name + "-keySwitchCapAt" + String(row) + "x" + String(col), {
          parent: [result.keySwitch, "center"],
          child: [result.cap, "baseCenter"],
          mirror: false,
          rotationFromNormal: 0,
        });

        var baseX = col * SWITCH_CENTER_X_SPACING;
        var rowOffset = this.rowOffsets[row] || 0;
        var colOffset = this.columnOffsets[col] || 0;
        if (rowOffset != 0 && colOffset != 0) {
          throw new Error("Having row offsets and column offsets simultaneously is not supported because it will cause key cap overlap.");
        }
        var parent = null;
        var parentConnector = null;
        if (col > 0) {
          // Connect switch to previous switch in row.
          parent = this.matrix[row][col - 1];
          var point = [-SWITCH_CENTER_X_SPACING, -colOffset, 0];
          parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
        } else if (row > 0) {
          // Connect switch to first switch in previous row.
          parent = this.matrix[row - 1][col];
          var point = [baseX - rowOffset, SWITCH_CENTER_Y_SPACING, 0];
          parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
        } else {
          // Switch at [0, 0] will be connected later.
        }

        if (parent) {
          var edgeKey = this.name + "-keySwitchAt" + String(row) + "x" + String(col);
          result.keySwitch.object.properties.parentKeySwitchCenter = parentConnector;
          this.csgDependencyTree.addConnection(edgeKey, {
            parent: [parent.keySwitch, "center"],
            child: [result.keySwitch, "parentKeySwitchCenter"],
            mirror: false,
            rotationFromNormal: 0,
          });
          result.parentObject = parent;
        }

        result.present = this.placementMatrix[row][col] == 1;

        this.matrix[row].push(result);
      }
    }

    if (!opts.csgDependencyTree) {
      this.csgDependencyTree.resolve();
    }
  }

  switchMatrixComponentsForDependencyTree(csgDependencyTree) {
    return new SwitchMatrixComponents({
      csgDependencyTree: csgDependencyTree,
      switchMatrix: this,
    });
  }

  get anchorSwitch() {
    return this.anchorDescriptor.keySwitch.object;
  }

  get anchorDescriptor() {
    return this.matrix[this.anchorSwitchCoordinates[0]][this.anchorSwitchCoordinates[1]];
  }

  get spacerDepth() {
   return this.caseBaseRadiiFromSwitchCenters.exterior - this.caseBaseRadiiFromSwitchCenters.interior;
  }

  get rows() {
    return this.matrix.length;
  }

  get columns() {
    return this.matrix[0].length;
  }

  get plate() {
    if (this._plate) {
       return this._plate;
    } else {
      var plate = this._exteriorHull.extrude({offset: [0, 0, SWITCH_PLATE_THICKNESS]});
      var anchorCenter = this.anchorSwitch.properties.center.point;
      plate.properties[this.name + "Matrix-anchorSwitch"] = new CSG.Connector(
        [anchorCenter.x, anchorCenter.y, SWITCH_PLATE_THICKNESS / 2],
        [0, 0, 1],
        [0, 1, 0]
      );
      this._plate = plate;
      return plate;
    }
  }

  get cutout() {
    if (this._cutout) {
       return this._cutout;
    } else {
      var cutout = this._interiorHull.extrude({offset: [0, 0, SWITCH_PLATE_THICKNESS]});
      var anchorCenter = this.anchorSwitch.properties.center.point;
      cutout.properties[this.name + "Matrix-anchorSwitch"] = new CSG.Connector(
        [anchorCenter.x, anchorCenter.y, SWITCH_PLATE_THICKNESS / 2],
        [0, 0, 1],
        [0, 1, 0]
      );
      this._cutout = cutout;
      return cutout;
    }
  }

  get switchHoles() {
    if (this._switchHoles) {
       return this._switchHoles;
    } else {
      var holes = this.matrix.reduce(function(solid, row) {
        return row.reduce(function (solid, descriptor) {
          return descriptor.present ? solid.union(descriptor.keySwitch.object) : solid;
        }, solid);
      }, new CSG());
      holes.properties[this.name + "Matrix-anchorSwitch"] = new CSG.Connector(
        this.anchorSwitch.properties.center.point,
        [0, 0, 1],
        [0, 1, 0]
      );
      this._switchHoles = holes;
      return holes;
    }
  }

  get keycaps() {
    if (this._keycaps) {
       return this._keycaps;
    } else {
      var caps = this.matrix.reduce(function(solid, row) {
        return row.reduce(function (solid, descriptor) {
          return descriptor.present ? solid.union(descriptor.cap.object) : solid;
        }, solid);
      }, new CSG());
      caps.properties[this.name + "Matrix-anchorSwitch"] = new CSG.Connector(
        this.anchorSwitch.properties.center.point,
        [0, 0, 1],
        [0, 1, 0]
      );
      this._keycaps = caps;
      return caps;
    }
  }

  get _exteriorHull() {
    return this._hull({
      radius: this.caseBaseRadiiFromSwitchCenters.exterior,
      offset: this.caseAdditionalRadiiOffsets.exterior,
      squareTopRightCorner: this.squareTopRightCorner,
    });
  }

  get _interiorHull() {
    return this._hull({
      radius: this.caseBaseRadiiFromSwitchCenters.interior,
      offset: this.caseAdditionalRadiiOffsets.interior,
      squareTopRightCorner: this.squareTopRightCorner,
    });
  }

  _hull(opts={radius: 0, offset: {}, squareTopRightCorner: false}) {
    var radius = opts.radius || 0;
    var offset = opts.offset || {};
    var squareTopRightCorner = opts.squareTopRightCorner;

    var topRow = [];
    for (var col = 0; col < this.matrix[0].length; ++col) {
      for (var row = 0; row < this.matrix.length; ++row) {
        if (this.matrix[row][col].present) {
          topRow.push(this.matrix[row][col].keySwitch.object.translate([0, offset.top || 0, 0]));
          break;
        }
      }
    }

    var rightColumn = [];
    for (var row = 0; row < this.matrix.length; ++row) {
      for (var col = this.matrix[row].length - 1; col >= 0; --col) {
        if (this.matrix[row][col].present) {
          rightColumn.push(this.matrix[row][col].keySwitch.object.translate([offset.right || 0, 0, 0]));
          break;
        }
      }
    }

    var bottomRow = [];
    for (var col = this.matrix[0].length - 1; col >= 0; --col) {
      for (var row = this.matrix.length - 1; row >= 0; --row) {
        if (this.matrix[row][col].present) {
          bottomRow.push(this.matrix[row][col].keySwitch.object.translate([0, offset.bottom || 0, 0]));
          break;
        }
      }
    }

    var leftColumn = [];
    for (var row = this.matrix.length - 1; row >= 0; --row) {
      for (var col = 0; col < this.matrix[row].length; ++col) {
        if (this.matrix[row][col].present) {
          leftColumn.push(this.matrix[row][col].keySwitch.object.translate([offset.left || 0, 0, 0]));
          break;
        }
      }
    }

    // Generate bounding squares for each switch.
    var borderSquares = [];
    var borderSegments = [topRow, rightColumn, bottomRow, leftColumn];
    for (var segment = 0; segment < borderSegments.length; ++segment) {
      for (var i = 0; i < borderSegments[segment].length; ++i) {
        var bounds = borderSegments[segment][i].getBounds();
        var center = [(bounds[0].x + bounds[1].x) / 2, (bounds[0].y + bounds[1].y) / 2];
        var square = CAG.rectangle({center: center, radius: (SWITCH_CENTER_Y_SPACING / 2) + radius});
        borderSquares.push(square);
      }
    }

    var calculatedHull = hull(borderSquares);

    if (squareTopRightCorner) {
      var hullBounds = calculatedHull.getBounds();
      for (var i = 0; i < calculatedHull.sides.length; ++i) {
        var side = calculatedHull.sides[i];
        if (side.vertex0.pos.x == hullBounds[1].x && side.vertex1.pos.x == hullBounds[1].x) {
          side.vertex1.pos = new CSG.Vector2D(side.vertex1.pos.x, hullBounds[1].y);
          var side2 = calculatedHull.sides[i + 1];
          side2.vertex0.pos = new CSG.Vector2D(side2.vertex0.pos.x, hullBounds[1].y);
          break;
        }
      }
    }

    return calculatedHull;
  }
}

class SwitchMatrixComponents {
  constructor(opts={
    csgDependencyTree: null,
    switchMatrix: null,
  }) {
    this.plate = opts.csgDependencyTree.nodeFor(opts.switchMatrix.plate);
    for (var csgProperty of ["keycaps", "switchHoles", "cutout"]) {
      this[csgProperty] = opts.csgDependencyTree.nodeFor(opts.switchMatrix[csgProperty]);
      opts.csgDependencyTree.addConnection(opts.switchMatrix.name + "Matrix-" + csgProperty, {
        parent: [this.plate, opts.switchMatrix.name + "Matrix-anchorSwitch"],
        child: [this[csgProperty], opts.switchMatrix.name + "Matrix-anchorSwitch"],
        mirror: false,
        rotationFromNormal: 0,
      });
    }
    this.switchMatrix = opts.switchMatrix;
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
SwitchMatrix = _SwitchMatrix;
