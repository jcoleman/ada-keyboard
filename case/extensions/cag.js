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
