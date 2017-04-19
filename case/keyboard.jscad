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
      this._addKeyCaps();
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

    // TODO: split CSGDependencyTree class in CSGLayoutDependencyTree and CSG<union/subtraction/intersection operation>DependencyTree
    // so that the above isn't necessary.
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
      child: [this.keycaps, "keycaps-primaryMatrix-anchorSwitch"],
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
    var primaryExteriorHull = this.primaryMatrix.switchMatrix._exteriorHull();
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

  //_addBottomCase() {
  bottomCaseCSG() {
    // TODO: We can't use the full exterior hull directly until we have an
    // algorithm in place to do triangulation for concave polygons.
    // var exteriorHull = this.primaryMatrix.exteriorHull.object.union(this.thumbMatrix.exteriorHull.object);

    // TODO: find the bounds center from the bottom cag and set it as a property
    // then we can do the same operations with the interior hull and subtract
    // to lessen the mass of the solid.

    var [primaryMatrixCAGs, thumbMatrixCAGs] = [this.primaryMatrix, this.thumbMatrix].map(function(matrix) {
      var exteriorHull = matrix.exteriorHull.object.withVerticesIn3D(0);

      // Rotate the CAG in 3D space before doing any other operation because
      // we need both the bottom and top polygons to have the same X, Y values
      // at each vertex.
      var rotatedCAG = exteriorHull.rotateY(-BOTTOM_CASE_TENTING_ANGLE);

      // Since we rotated around the center we need to translate to normalize the Z coordinates.
      // We also include the translation necessary to ensure a minimum thickness of the case.
      var topCAG = rotatedCAG.translate([0, 0, (exteriorHull.getBounds()[0].z - rotatedCAG.getBounds()[0].z) + BOTTOM_CASE_MINIMUM_THICKNESS]);
      // TODO: add explanation
      var bottomCAG = exteriorHull.transform(CSG.Matrix4x4.xScaleForRotationY(-BOTTOM_CASE_TENTING_ANGLE));

      return {
        top: topCAG,
        bottom: bottomCAG,
        exteriorHull: exteriorHull,
        rotatedCAG: rotatedCAG,
      };
    });

    thumbMatrixCAGs.top = thumbMatrixCAGs.top.connectTo(
      thumbMatrixCAGs.top.properties["anchorSwitchFromPrimaryMatrix"],
      primaryMatrixCAGs.top.properties["primaryMatrix-anchorSwitch"],
      false,
      THUMB_MATRIX_ROTATION
    );
    thumbMatrixCAGs.bottom = thumbMatrixCAGs.bottom.connectTo(
      thumbMatrixCAGs.bottom.properties["anchorSwitchFromPrimaryMatrix"],
      primaryMatrixCAGs.bottom.properties["primaryMatrix-anchorSwitch"],
      false,
      THUMB_MATRIX_ROTATION
    );

    var csgs = [primaryMatrixCAGs, thumbMatrixCAGs].map(function({top, bottom}) {
      // Build the bottom and top polygons.
      var polygons = [bottom, top].reduce(function(acc, cag) {
        var vertices = cag.sides.map(function(side) { return new CSG.Vertex(side.vertex0.pos); });
        for (var i = vertices.length - 3; i >= 0; --i) {
          var triangle = new CSG.Polygon([
            vertices[0], vertices[i + 1], vertices[i + 2]
          ]);

          if (cag === bottom) {
            triangle.setColor([0, 1, 0]);
            triangle = triangle.flipped();
          } else {
            triangle.setColor([0, 0, 1]);
          }

          acc.push(triangle);
        }
        return acc;
      }, []);

      // Build the wall polygons.
      for (var i = 0; i < top.sides.length; ++i) {
        var topSide = top.sides[i];
        var bottomSide = bottom.sides[i];
        // Every bottom/top polygon side pair forms the rectangle T0-T1-B1-B0;
        // split each rectangle into two triangles: B1-B0-T0 and B1-T0-T1.
        polygons.push(
           new CSG.Polygon([
             new CSG.Vertex(bottomSide.vertex1.pos),
             new CSG.Vertex(bottomSide.vertex0.pos),
             new CSG.Vertex(topSide.vertex0.pos),
           ]).flipped(),
           new CSG.Polygon([
             new CSG.Vertex(bottomSide.vertex1.pos),
             new CSG.Vertex(topSide.vertex0.pos),
             new CSG.Vertex(topSide.vertex1.pos),
           ]).flipped()
        );
      }

      // Validate that we haven't messed up our conversion into convex polygons.
      polygons.forEach(function(polygon, i) {
        if (!CSG.Polygon.verticesConvex(polygon.vertices, polygon.plane.normal)) {
          throw new Error("Found concave polygon at index " + i);
        }
      });

      return CSG.fromPolygons(polygons);
    });

    return csgs.reduce(function (acc, csg) {
      return acc.union(csg);
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

    var rawThumbMatrix = new SwitchMatrix({
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
    });
    this.thumbMatrix = rawThumbMatrix.switchMatrixComponentsForDependencyTree(csgDependencyTree);

    rawThumbMatrix.allObjects.forEach(function(object) {
      object.properties.anchorSwitchFromPrimaryMatrix = new CSG.Connector(
        [-4, SWITCH_CENTER_Y_SPACING + 3, object.properties["thumbMatrix-anchorSwitch"].point.z],
        [0, 0, 1],
        [0, 1, 0]
      );
    });

    csgDependencyTree.addConnection("thumbMatrix-plate", {
      parent: [this.primaryMatrix.plate, "primaryMatrix-anchorSwitch"],
      child: [this.thumbMatrix.plate, "anchorSwitchFromPrimaryMatrix"],
      mirror: false,
      rotationFromNormal: THUMB_MATRIX_ROTATION,
    });

    csgDependencyTree.resolve();
  }
}

// Shim since OpenJSCAD's `include` eval's the code and classes
// inside an eval scope are not defined outside of that scope.
Keyboard = _Keyboard;
