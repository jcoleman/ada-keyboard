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

  it('builds the full part with the expected bounds', () => {
    const promise = generateOutputData({renderedPart: 'full'}, {inputFile: "case/main.jscad"});
    return promise.then(objects => {
      expect(objects).toBeInstanceOf(Array);
      expect(objects.length).toBe(1);
      expect(objects[0].getBounds()).toEqual(
        // Magic values from previously visually confirmed valid run
        // to be able to sanity check that refactors don't completely
        // break rendering.
        [
          {"_x": -75.80851303331261, "_y": -81.04444872241592, "_z": 0},
          {"_x": 75.80851303331261, "_y": 81.04444872241592, "_z": 57.36726290341663}
        ]
      );
    });
  });
});
