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
    // TODO:
    // 1. test with a square cag: same results
    // 2. test without rotation: same results
    // 3. test with polygon order [top, sides, bottom] (and variations): same results
    // fix: use `flipped()` (to ensure proper polygon facing direction?)

    //var exteriorHull = this.primaryMatrix.exteriorHull.object.union(this.thumbMatrix.exteriorHull.object);
    var csgs = [
      //CAG.rectangle({center: [0,0], radius: [50, 50]}),
      this.primaryMatrix.exteriorHull.object,
      this.thumbMatrix.exteriorHull.object,
    ].map(function(exteriorHull) {;
      var exteriorHullVertices = exteriorHull.sides.reduce(function(acc, side) {
        acc.push(side.vertex0, side.vertex1);
        return acc;
      }, []);
      for (var vertex of exteriorHullVertices) {
        vertex.pos = new CSG.Vector3D([vertex.pos.x, vertex.pos.y, 0]);
      }

      var rotatedCAG = exteriorHull.rotateY(-BOTTOM_CASE_TENTING_ANGLE);
      var topCAG = rotatedCAG.translate([0, 0, -rotatedCAG.getBounds()[0].z + BOTTOM_CASE_MINIMUM_THICKNESS]);
      // var rotatedCAG = exteriorHull;
      // var topCAG = rotatedCAG.translate([0, 0, -rotatedCAG.getBounds()[0].z + 50]);

      // TODO find the bounds center from the bottom cag and set it as a property
      // then we can do the same operations with the interior hull and subtract
      // to lessen the mass of the solid.
      var bottomCAG = CAG.fromObject(rotatedCAG);
      var bottomCAGVertices = bottomCAG.sides.reduce(function(acc, side) {
        acc.push(side.vertex0, side.vertex1);
        return acc;
      }, []);
      for (var vertex of bottomCAGVertices) {
        vertex.pos = new CSG.Vector3D([vertex.pos.x, vertex.pos.y, 0]);
      }

      // var rotatedCAG2D = CAG.fromObject(rotatedCAG);
      // var rotatedCAG2DVertices = rotatedCAG2D.sides.reduce(function(acc, side) {
      //   acc.push(side.vertex0, side.vertex1);
      //   return acc;
      // }, []);
      // for (var vertex of rotatedCAG2DVertices) {
      //   vertex.pos = new CSG.Vector2D([vertex.pos.x, vertex.pos.y]);
      // }
      // var topPolygons = rotatedCAG2D._toPlanePolygons({
      //   toConnector: new CSG.Connector([0, 0, 0], [0, 0, 1], [0, 1, 0]).rotateY(-BOTTOM_CASE_TENTING_ANGLE),
      // });
      // var topPolygonsMinVector = topPolygons.reduce(function(minVector, polygon) {
      //   return polygon.vertices.reduce(function(minVector, vertex) {
      //     return minVector.min(vertex.pos);
      //   }, minVector);
      // }, topPolygons[0].vertices[0].pos);
      // var topPolygonsMaxVector = topPolygons.reduce(function(maxVector, polygon) {
      //   return polygon.vertices.reduce(function(maxVector, vertex) {
      //     return maxVector.max(vertex.pos);
      //   }, maxVector);
      // }, topPolygons[0].vertices[0].pos);
      // var bottomCAGBounds = bottomCAG.getBounds();
      // topPolygons = topPolygons.map(function(tri) {
      //   tri.setColor([0, 1, 0]);
      //   return tri.translate([topPolygonsMinVector.x - bottomCAGBounds[0].x, 0, -topPolygonsMinVector.z + BOTTOM_CASE_MINIMUM_THICKNESS]);
      // });
      // var bottomPolygons = rotatedCAG2D._toPlanePolygons({
      //   toConnector: new CSG.Connector([0, 0, 0], [0, 0, 1], [0, 1, 0]),
      // });
      // bottomPolygons = bottomPolygons.map(function(tri) {
      //   tri.setColor([0, 0, 1]);
      //   return tri;
      // });
      // var polygons = topPolygons.concat(bottomPolygons);


      var polygons = [bottomCAG, topCAG].reduce(function(acc, cag) {
        var points = cag.sides.map(function(side) { return side.vertex0.pos; });
        var vertices = points.map(function(point) { return new CSG.Vertex(point); });
        var plane = CSG.Plane.fromManyPoints.apply(CSG.Plane.fromManyPoints, points);
        var poly = new CSG.Polygon(vertices);
        // var origCount = acc.length;
        var firstVertex = poly.vertices[0];
        for (var i = poly.vertices.length - 3; i >= 0; i--) {
          acc.push(new CSG.Polygon([
            firstVertex, poly.vertices[i + 1], poly.vertices[i + 2]
          ],
          poly.shared, plane));
          if (cag === bottomCAG) {
            acc[acc.length - 1].setColor([0, 1, 0]);
            acc[acc.length - 1] = acc[acc.length - 1].flipped();
          } else {
            acc[acc.length - 1].setColor([0, 0, 1]);
          }
        }
        // if (cag === bottomCAG) {
        //   poly = poly.flipped().setColor([0, 1, 0]);
        // } else {
        //   poly = poly.setColor([0, 0, 1]);
        // }
        // acc.push(poly);
        return acc;
      }, []);

      for (var i = 0; i < topCAG.sides.length; ++i) {
        var topSide = topCAG.sides[i];
        var bottomSide = bottomCAG.sides[i];
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

      polygons.forEach(function(polygon, i) {
        if (!CSG.Polygon.verticesConvex(polygon.vertices, polygon.plane.normal)) {
          throw new Error("concave " + i);
        }
      });

      return CSG.fromPolygons(polygons);
    });

    return csgs[0];//.canonicalized().reTesselated();//.toPointCloud([2, 2, 2]);
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
