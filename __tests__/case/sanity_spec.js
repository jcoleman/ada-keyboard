const generateOutputData = require('../render_helpers').generateOutputData

const jscad = require("@jscad/csg");
global.CSG = jscad.CSG;
global.CAG = jscad.CAG;

describe('SplitKeyboard', () => {
  it('builds the switch plate with the expected bounds', () => {
    const promise = generateOutputData({keyboardStyle: "splitLeft", renderedPart: 'switchPlate'}, {inputFile: "case/main.js"});
    return promise.then(objects => {
      expect(objects).toBeInstanceOf(Array);
      expect(objects.length).toBe(1);
      objects.forEach(object => {
        expect(object).toBeInstanceOf(CSG);
      });

      expect(objects[0].getBounds()).toEqual(
        // Magic values from previously visually confirmed valid run
        // to be able to sanity check that refactors don't completely
        // break rendering.
        [
          {"_x": -78.73502864150389, "_y": -80.88082342452822, "_z": 0},
          {"_x": 78.73502864150389, "_y": 80.88082342452822, "_z": 6.0000000000000036}
        ]
      );
    });
  });

  it('builds the full part with the expected bounds', () => {
    const promise = generateOutputData({keyboardStyle: "splitLeft", renderedPart: 'full'}, {inputFile: "case/main.js"});
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
