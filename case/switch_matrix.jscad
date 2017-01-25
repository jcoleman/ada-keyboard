include("constants.jscad");
include("switch.jscad");

class _SwitchMatrix {
  // Builds a matrix of key switch descriptors that are unconnected
  // but contain the information to be connected.
  // The first switch (at coordinates[0, 0]) will not have connecting
  // information.
  constructor(opts={
    placementMatrix: [[]],
    columnOffsets: [],
    rowOffsets: [],
    caseBaseRadiiFromSwitchCenters: {}, // E.g., {interior: 5, exterior, 10}
    caseAdditionalRadiiOffsets: {}, // E.g., {exterior: {bottom: -25, top: 5}}
  }) {
    this.placementMatrix = opts.placementMatrix;
    this.columnOffsets = opts.columnOffsets;
    this.rowOffsets = opts.rowOffsets;
    this.caseBaseRadiiFromSwitchCenters = opts.caseBaseRadiiFromSwitchCenters;
    this.caseAdditionalRadiiOffsets = opts.caseAdditionalRadiiOffsets || {};
    this.matrix = [];

    for (var row = 0; row < this.placementMatrix.length; ++row) {
      var baseY = row * SWITCH_CENTER_Y_SPACING;

      this.matrix.push([]);
      for (var col = 0; col < this.placementMatrix[row].length; ++col) {
        var result = {
          keySwitch: switchHole(),
          cap: keyCap(),
          parentSwitchLocation: null,
          parentConnector: null,
          ownLocation: [row, col],
        };

        var baseX = col * SWITCH_CENTER_X_SPACING;
        var rowOffset = this.rowOffsets[row] || 0;
        var colOffset = this.columnOffsets[col] || 0;
        if (rowOffset != 0 && colOffset != 0) {
          throw new Error("Having row offsets and column offsets simultaneously is not supported because it will cause key cap overlap.");
        }
        if (col > 0) {
          // Connect switch to previous switch in row.
          result.parentSwitchLocation = [row, col - 1];
          var point = [-SWITCH_CENTER_X_SPACING, -colOffset, 0];
          result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
        } else if (row > 0) {
          // Connect switch to first switch in previous row.
          result.parentSwitchLocation = [row - 1, col];
          var point = [baseX - rowOffset, SWITCH_CENTER_Y_SPACING, 0];
          result.parentConnector = new CSG.Connector(point, [0, 0, 1], [0, 1, 0]);
        } else {
          // Switch at [0, 0] will be connected later.
        }

        result.present = this.placementMatrix[row][col] == 1;

        this.matrix[row].push(result);
      }
    }
  }

  get spacerDepth() {
   return this.caseBaseRadiiFromSwitchCenters.exterior - this.caseBaseRadiiFromSwitchCenters.interior;
  }

  // Add connections between the switches in an unconnected
  // descriptor matrix.
  // We have to delay adding these connections until after the
  // connection information (if any) is added to the switch in
  // this matrix that links it to another object since connections
  // don't cause cascading changes.
  connectSwitches(opts={center: false}) {
    for (var row = 0; row < this.matrix.length; ++row) {
      for (var col = 0; col < this.matrix[row].length; ++col) {
        var descriptor = this.matrix[row][col];
        var parentObject = null;
        if (descriptor.parentObject) {
          parentObject = descriptor.parentObject;
        } else if (descriptor.parentSwitchLocation) {
          var parentDescriptor = this.matrix;
          for (var i = 0; i < descriptor.parentSwitchLocation.length; ++i) {
            parentDescriptor = parentDescriptor[descriptor.parentSwitchLocation[i]];
          }
          parentObject = parentDescriptor.keySwitch;
        }
        if (parentObject) {
          if (!descriptor.keySwitch.properties.parentSwitchCenter && descriptor.parentConnector) {
            descriptor.keySwitch.properties.parentSwitchCenter = descriptor.parentConnector;
          }
          var updatedKeySwitch = descriptor.keySwitch
          var updatedCap = descriptor.cap;
          if (opts.center) {
            updatedKeySwitch = updatedKeySwitch.center();
            updatedCap = updatedCap.center();
          }
          updatedKeySwitch = updatedKeySwitch.connectTo(
            descriptor.parentConnector,
            parentObject.properties[descriptor.parentObjectConnectorName || "center"],
            false,
            0
          );
          descriptor.keySwitch = updatedKeySwitch;
          descriptor.cap = updatedCap.connectTo(
            updatedCap.properties.baseCenter,
            descriptor.keySwitch.properties.center,
            false,
            0
          );
        }
      }
    }
  }

  exteriorHull(opts={squareTopRightCorner: false}) {
    return this._hull({
      radius: this.caseBaseRadiiFromSwitchCenters.exterior,
      offset: this.caseAdditionalRadiiOffsets.exterior,
      squareTopRightCorner: opts.squareTopRightCorner,
    });
  }

  interiorHull(opts={squareTopRightCorner: false}) {
    return this._hull({
      radius: this.caseBaseRadiiFromSwitchCenters.interior,
      offset: this.caseAdditionalRadiiOffsets.interior,
      squareTopRightCorner: opts.squareTopRightCorner,
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
          topRow.push(this.matrix[row][col].keySwitch.translate([0, offset.top || 0, 0]));
          break;
        }
      }
    }

    var rightColumn = [];
    for (var row = 0; row < this.matrix.length; ++row) {
      for (var col = this.matrix[row].length - 1; col >= 0; --col) {
        if (this.matrix[row][col].present) {
          rightColumn.push(this.matrix[row][col].keySwitch.translate([offset.right || 0, 0, 0]));
          break;
        }
      }
    }

    var bottomRow = [];
    for (var col = this.matrix[0].length - 1; col >= 0; --col) {
      for (var row = this.matrix.length - 1; row >= 0; --row) {
        if (this.matrix[row][col].present) {
          bottomRow.push(this.matrix[row][col].keySwitch.translate([0, offset.bottom || 0, 0]));
          break;
        }
      }
    }

    var leftColumn = [];
    for (var row = this.matrix.length - 1; row >= 0; --row) {
      for (var col = 0; col < this.matrix[row].length; ++col) {
        if (this.matrix[row][col].present) {
          leftColumn.push(this.matrix[row][col].keySwitch.translate([offset.left || 0, 0, 0]));
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

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
SwitchMatrix = _SwitchMatrix;
