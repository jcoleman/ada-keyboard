//require("../../case/keyboard.jscad")
const generateOutputData = require('../render_helpers').generateOutputData
var jscad = require("@jscad/csg")
CSG = jscad.CSG
CAG = jscad.CAG
//const rebuildSolid = require('../core/rebuildSolid').rebuildSolid

describe('Keyboard', () => {
  it('builds the switch plate without blowing up', () => {
    const keyboard = new Keyboard({renderedPart: 'switchPlate'});
    expect(() => {
      expect(keyboard.buildCSG()).toBeInstanceOf(CSG);
    }).not.toThrow();
  });

  it('builds the base without blowing up', () => {
    const keyboard = new Keyboard({renderedPart: 'base'});
    expect(() => {
      expect(keyboard.buildCSG()).toBeInstanceOf(CSG);
    }).not.toThrow();
  });
});
