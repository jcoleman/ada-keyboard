// CAG = class extends CAG {
//   constructor() {
//     this.super();
//     this.properties = new CSG.Properties();
//   }
//
//   transform(matrix4x4) {
//     var result = this.super(matrix4x4);
//     result.properties = this.properties._transform(matrix4x4);
//   }
// }
CAG.prototype.transformWithoutProperties = CAG.prototype.transform;
CAG.prototype.transform = function(matrix4x4) {
  var result = this.transformWithoutProperties(matrix4x4);
  if (this.properties) {
    result.properties = this.properties._transform(matrix4x4);
  }
  return result;
}
//CAG.prototype.getTransformationTo = CSG.Connector.prototype.getTransformationTo;
CAG.prototype.connectTo = CSG.prototype.connectTo;
CAG.prototype.withVerticesIn3D = function(z) {
  var copy = CAG.fromObject(this);
  for (var side of copy.sides) {
    var pos0 = side.vertex0.pos;
    side.vertex0.pos = new CSG.Vector3D([pos0.x, pos0.y, z]);
    var pos1 = side.vertex1.pos;
    side.vertex1.pos = new CSG.Vector3D([pos1.x, pos1.y, z]);
  }
  return copy;
}
