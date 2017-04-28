const generateOutputData = require('../render_helpers').generateOutputData

const jscad = require("@jscad/csg");
global.CSG = jscad.CSG;
global.CAG = jscad.CAG;

describe('Keyboard', () => {
  it('builds the switch plate without blowing up', () => {
    const promise = generateOutputData({renderedPart: 'switchPlate'}, {inputFile: "case/main.jscad"});
    return promise.then(objects => {
      expect(objects).toBeInstanceOf(Array);
      objects.forEach(object => {
        expect(object).toBeInstanceOf(CSG);
      });
    });
  });
});
