CSG.prototype.getBoundsCenter = function() {
  var bounds = this.getBounds();
  return new CSG.Vector3D([
    (bounds[0].x + bounds[1].x) / 2,
    (bounds[0].y + bounds[1].y) / 2,
    (bounds[0].z + bounds[1].z) / 2,
  ]);
}
