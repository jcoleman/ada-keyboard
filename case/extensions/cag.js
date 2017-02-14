CAG.prototype.transformWithoutProperties = CAG.prototype.transform;
CAG.prototype.transform = function(matrix4x4) {
  var result = this.transformWithoutProperties(matrix4x4);
  if (this.properties) {
    result.properties = this.properties._transform(matrix4x4);
  }
  return result;
}
CAG.prototype.connectTo = CSG.prototype.connectTo;
CAG.prototype.withVerticesIn3D = function(z) {
  var copy = CAG.fromObject(this);
  for (var side of copy.sides) {
    var pos0 = side.vertex0.pos;
    side.vertex0.pos = new CSG.Vector3D([pos0.x, pos0.y, z]);
    var pos1 = side.vertex1.pos;
    side.vertex1.pos = new CSG.Vector3D([pos1.x, pos1.y, z]);
  }
  if (this.properties) {
    // We don't try to adjust anything in properties since we wouldn't know
    // how to change it (it would generally already have 3D elements but those
    // don't strictly make sense anyway in this 2D space).
    copy.properties = new CSG.Properties();
    CSG.Properties.cloneObj(this.properties, copy.properties);
  }
  return copy;
}
