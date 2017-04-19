CSG.prototype.getBoundsCenter = function() {
  var bounds = this.getBounds();
  return new CSG.Vector3D([
    (bounds[0].x + bounds[1].x) / 2,
    (bounds[0].y + bounds[1].y) / 2,
    (bounds[0].z + bounds[1].z) / 2,
  ]);
}

CSG.Plane.fromManyPoints = function() {
   var first=arguments[1].minus(arguments[0]);
   var normal= {};
   var i=2;
   do {
      normal=first.cross(arguments[i].minus(arguments[0]));
      i++;
   } while (i<arguments.length && normal.dot(normal)<1e-10)
   var n=normal.unit();
   return new CSG.Plane(n,n.dot(arguments[0]));
};

CSG.Matrix4x4.xScaleForRotationY = function(degrees) {
  var radians = degrees * Math.PI * (1.0 / 180.0);
  var cos = Math.cos(radians);
  var sin = Math.sin(radians);
  var els = [
    cos, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
  ];
  return new CSG.Matrix4x4(els);
};

