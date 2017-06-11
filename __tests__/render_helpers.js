const register = require('babel-register');
register({
  ignore: /node_modules\/(?!openjscad)/,
});

const fs = require('fs')
const {isAbsolute, resolve} = require('path');
const oscad = require('@jscad/scad-api');
const convertToBlob = require('openjscad/src/io/convertToBlob').convertToBlob;
const formats = require('openjscad/src/io/formats').formats;
const rebuildSolid = require('openjscad/src/core/rebuildSolid').rebuildSolid;
const resolveIncludesFs = require('openjscad/src/utils/resolveIncludesFs').resolveIncludesFs;
const getParameterDefinitionsCLI = require('openjscad/src/cli/getParameterDefinitionsCLI');

/**
 * generate output data from source; adapted from CLI code in OpenJSCAD
 * @param {String} source the original source
 * @param {Object} params hash of parameters to pass to main function
 * @param {String} options
 * @return a Promise with the output data
 */
exports.generateOutputData = function(params, options) {
  const defaults = {
    implicitGlobals: true,
    outputFormat: 'stl',
    inputFile: ''
  }
  options = Object.assign({}, defaults, options)
  const {implicitGlobals, outputFormat, inputFile} = options

  let source = fs.readFileSync(inputFile, inputFile.match(/\.stl$/i) ? 'binary' : 'UTF8')
  const inputPath = isAbsolute(inputFile) ? inputFile : resolve(process.cwd(), inputFile)  // path.dirname(inputFile)

  let globals = {}
  if (implicitGlobals) {
    globals.oscad = oscad
  }
  globals.extras = {cli: {getParameterDefinitionsCLI}}

  // modify main to adapt parameters
  const mainFunction = `var wrappedMain = main
  main = function(){
    var paramsDefinition = (typeof getParameterDefinitions !== 'undefined') ? getParameterDefinitions : undefined
    return wrappedMain(getParameterDefinitionsCLI(paramsDefinition, ${JSON.stringify(params)}))
  }`
  source = `${source}
  ${mainFunction}
  `

  return new Promise(function (resolve, reject) {
    if (outputFormat === 'jscad' || outputFormat === 'js') {
      resolve(source)
    } else {
      const callback = (err, result) => {
        if (!err) {
          return resolve(result)
        }
        return reject(err)
      }

      rebuildSolid(source, inputPath, params, callback, {implicitGlobals, globals, includeResolver: resolveIncludesFs})
    }
  })
}

