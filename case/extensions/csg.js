if (!CSG.hasBeenExtendedForAdaKeyboard) {
  CSG.hasBeenExtendedForAdaKeyboard = true;

  CSG.prototype.getBoundsCenter = function() {
    var bounds = this.getBounds();
    return new CSG.Vector3D([
      (bounds[0].x + bounds[1].x) / 2,
      (bounds[0].y + bounds[1].y) / 2,
      (bounds[0].z + bounds[1].z) / 2,
    ]);
  }

  // Rotation around the Y axis would normally change the scale of coordinates
  // in the X axis as well as change the plane to which all Z axis coordinates
  // relate. This function returns a matrix that applies the equivalent X axis
  // scaling transformation without the Z plane modifications.
  CSG.Matrix4x4.xScaleForRotationY = function(degrees) {
    var radians = degrees * Math.PI * (1.0 / 180.0);
    var cos = Math.cos(radians);
    var els = [
      cos, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
    ];
    return new CSG.Matrix4x4(els);
  };
}
