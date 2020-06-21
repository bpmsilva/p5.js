/**
 * @for p5
 * @requires core
 *
 * This is the main file for the Friendly Error System (FES). Here is a
 * brief outline of the functions called in this system.
 *
 * The FES may be invoked by a call to either (1) _validateParameters,
 * (2) _friendlyFileLoadError, (3) _friendlyError, or (4) helpForMisusedAtTopLevelCode.
 *
 * helpForMisusedAtTopLevelCode is called by this file on window load to check for use
 * of p5.js functions outside of setup() or draw()
 * Items 1-3 above are called by functions in the p5 library located in other files.
 *
 * _friendlyFileLoadError is called by the loadX() methods.
 * _friendlyError can be called by any function to offer a helpful error message.
 *
 * _validateParameters is called by functions in the p5.js API to help users ensure
 * ther are calling p5 function with the right parameter types. The property
 * disableFriendlyErrors = false can be set from a p5.js sketch to turn off parameter
 * checking. The call sequence from _validateParameters looks something like this:
 *
 * _validateParameters
 *   lookupParamDoc
 *   scoreOverload
 *     testParamTypes
 *     testParamType
 *   getOverloadErrors
 *   _friendlyParamError
 *     ValidationError
 *     report
 *       friendlyWelcome
 *
 * The call sequences to _friendlyFileLoadError and _friendlyError are like this:
 * _friendlyFileLoadError
 *   report
 *
 * _friendlyError
 *   report
 *
 * report() is the main function that prints directly to console with the output
 * of the error helper message. Note: friendlyWelcome() also prints to console directly.
 */
import p5 from '../main';
import { translator } from '../internationalization';

// p5.js blue, p5.js orange, auto dark green; fallback p5.js darkened magenta
// See testColors below for all the color codes and names
const typeColors = ['#2D7BB6', '#EE9900', '#4DB200', '#C83C00'];
let misusedAtTopLevelCode = null;
let defineMisusedAtTopLevelCode = null;

// the threshold for the maximum allowed levenshtein distance
// used in misspelling detection
const EDIT_THRESH = 2;

if (typeof IS_MINIFIED !== 'undefined') {
  p5._friendlyError = p5._checkForUserDefinedFunctions = p5._fesErrorMonitor = () => {};
} else {
  let doFriendlyWelcome = false; // TEMP until we get it all working LM

  const errorTable = require('./browser_errors').default;

  // -- Borrowed from jQuery 1.11.3 --
  const class2type = {};
  const toString = class2type.toString;
  const names = [
    'Boolean',
    'Number',
    'String',
    'Function',
    'Array',
    'Date',
    'RegExp',
    'Object',
    'Error'
  ];
  for (let n = 0; n < names.length; n++) {
    class2type[`[object ${names[n]}]`] = names[n].toLowerCase();
  }
  const getType = obj => {
    if (obj == null) {
      return `${obj}`;
    }
    return typeof obj === 'object' || typeof obj === 'function'
      ? class2type[toString.call(obj)] || 'object'
      : typeof obj;
  };

  // -- End borrow --

  const friendlyWelcome = () => {
    // p5.js brand - magenta: #ED225D
    //const astrixBgColor = 'transparent';
    //const astrixTxtColor = '#ED225D';
    //const welcomeBgColor = '#ED225D';
    //const welcomeTextColor = 'white';
    const welcomeMessage = translator('fes.pre', {
      message: translator('fes.welcome')
    });
    console.log(
      '    _ \n' +
        ' /\\| |/\\ \n' +
        " \\ ` ' /  \n" +
        ' / , . \\  \n' +
        ' \\/|_|\\/ ' +
        '\n\n' +
        welcomeMessage
    );
  };

  /**
   * Prints out a fancy, colorful message to the console log
   *
   * @method report
   * @private
   * @param  {String}               message the words to be said
   * @param  {String}               func    the name of the function to link
   * @param  {Number|String} color   CSS color string or error type
   *
   * @return console logs
   */
  const report = (message, func, color) => {
    if (doFriendlyWelcome) {
      friendlyWelcome();
      doFriendlyWelcome = false;
    }
    if ('undefined' === getType(color)) {
      color = '#B40033'; // dark magenta
    } else if (getType(color) === 'number') {
      // Type to color
      color = typeColors[color];
    }
    if (func.substring(0, 4) === 'load') {
      console.log(translator('fes.pre', { message }));
    } else {
      const methodParts = func.split('.');
      const referenceSection =
        methodParts.length > 1 ? `${methodParts[0]}.${methodParts[1]}` : 'p5';

      const funcName =
        methodParts.length === 1 ? func : methodParts.slice(2).join('/');

      console.log(
        translator('fes.pre', {
          message: `${message} (http://p5js.org/reference/#/${referenceSection}/${funcName})`
        })
      );
    }
  };
  /**
   * This is a generic method that can be called from anywhere in the p5
   * library to alert users to a common error.
   *
   * @method _friendlyError
   * @private
   * @param  {Number} message message to be printed
   * @param  {String} method name of method
   * @param  {Number|String} [color]   CSS color string or error type (Optional)
   */
  p5._friendlyError = function(message, method, color) {
    report(message, method, color);
  };

  /**
   * This is called internally if there is a error with autoplay.
   *
   * @method _friendlyAutoplayError
   * @private
   */
  p5._friendlyAutoplayError = function(src) {
    const message = translator('fes.autoplay', {
      src,
      link: 'https://developer.mozilla.org/docs/Web/Media/Autoplay_guide'
    });
    console.log(translator('fes.pre', { message }));
  };

  const editDistance = (w1, w2) => {
    // An implementation of
    // https://en.wikipedia.org/wiki/Wagner%E2%80%93Fischer_algorithm
    // to compute the Levenshtein distance
    const l1 = w1.length,
      l2 = w2.length;
    if (l1 === 0) return w2;
    if (l2 === 0) return w1;

    let prev = [];
    let cur = [];

    for (let j = 0; j < l2 + 1; j++) {
      cur[j] = j;
    }

    prev = cur;

    for (let i = 1; i < l1 + 1; i++) {
      cur = [];
      for (let j = 0; j < l2 + 1; j++) {
        if (j === 0) {
          cur[j] = i;
        } else {
          let a1 = w1[i - 1],
            a2 = w2[j - 1];
          let temp = 999999;
          let cost = a1.toLowerCase() === a2.toLowerCase() ? 0 : 1;
          temp = temp > cost + prev[j - 1] ? cost + prev[j - 1] : temp;
          temp = temp > 1 + cur[j - 1] ? 1 + cur[j - 1] : temp;
          temp = temp > 1 + prev[j] ? 1 + prev[j] : temp;
          cur[j] = temp;
        }
      }
      prev = cur;
    }

    return cur[l2];
  };

  // checks if the various functions such as setup, draw, preload have been
  // defined with capitalization mistakes
  const checkForUserDefinedFunctions = context => {
    if (p5.disableFriendlyErrors) return;

    // if using instance mode, this function would be called with the current
    // instance as context
    const instanceMode = context instanceof p5;
    context = instanceMode ? context : window;
    const log = p5._fesLogger;
    const fnNames = [
      'setup',
      'draw',
      'preload',
      'deviceMoved',
      'deviceTurned',
      'deviceShaken',
      'doubleClicked',
      'mousePressed',
      'mouseReleased',
      'mouseMoved',
      'mouseDragged',
      'mouseClicked',
      'mouseWheel',
      'touchStarted',
      'touchMoved',
      'touchEnded',
      'keyPressed',
      'keyReleased',
      'keyTyped',
      'windowResized'
    ];

    const fxns = {};
    // lowercasename -> actualName mapping
    fnNames.forEach(symbol => {
      fxns[symbol.toLowerCase()] = symbol;
    });

    for (const prop of Object.keys(context)) {
      const lowercase = prop.toLowerCase();

      // check if the lowercase property name has an entry in fxns, if the
      // actual name with correct capitalization doesnt exist in context,
      // and if the user-defined symbol is of the type function
      if (
        fxns[lowercase] &&
        !context[fxns[lowercase]] &&
        typeof context[prop] === 'function'
      ) {
        const msg = translator('fes.checkUserDefinedFns', {
          name: prop,
          actualName: fxns[lowercase]
        });
        if (log && typeof log === 'function') {
          log(msg);
        } else {
          p5._friendlyError(msg, fxns[lowercase]);
        }
      }
    }
  };

  // compares the the symbol caught in the ReferenceErrror to everything
  // in misusedAtTopLevel ( all public p5 properties ). The use of
  // misusedAtTopLevel here is for convenience as it was an array that was
  // already defined when spelling check was implemented. For this particular
  // use-case, it's a misnomer.
  const handleMisspelling = (errSym, error, log) => {
    if (!misusedAtTopLevelCode) {
      defineMisusedAtTopLevelCode();
    }

    let min = 999999,
      minIndex = 0;
    // compute the levenshtein distance for the symbol against all known
    // public p5 properties. Find the property with the minimum distance
    misusedAtTopLevelCode.forEach((symbol, idx) => {
      let dist = editDistance(errSym, symbol.name);
      if (dist < min) {
        min = dist;
        minIndex = idx;
      }
    });

    if (min > EDIT_THRESH) return;

    let symbol = misusedAtTopLevelCode[minIndex];

    // Show a message only if the caught symbol and the matched property name
    // differ in their name ( either letter difference or difference of case )
    if (errSym !== symbol.name) {
      const parsed = p5._getErrorStackParser().parse(error);
      const location =
        parsed[0] && parsed[0].fileName
          ? `${parsed[0].fileName}:${parsed[0].lineNumber}:${
              parsed[0].columnNumber
            }`
          : null;
      const msg = translator('fes.misspelling', {
        name: errSym,
        actualName: symbol.name,
        type: symbol.type,
        location: location ? translator('fes.location', { location }) : ''
      });

      if (log) {
        log(msg);
      } else {
        p5._friendlyError(msg, symbol.name);
      }
    }
  };

  const fesErrorMonitor = e => {
    if (p5.disableFriendlyErrors) return;
    // This function can receieve an Error object or an ErrorEvent
    const error = e instanceof ErrorEvent ? e.error : e;
    const log = p5._fesLogger;
    switch (error.name) {
      case 'ReferenceError': {
        const errList = errorTable.ReferenceError;
        for (const obj of errList) {
          let string = obj.msg;
          // capture the primary symbol mentioned in the error
          string = string.replace('{{}}', '([a-zA-Z0-9_]+)');
          string = string.replace('{}', '(?:[a-zA-Z0-9_]+)');
          let matched = error.message.match(string);
          if (matched && matched[1]) {
            handleMisspelling(
              matched[1],
              error,
              typeof log === 'function' ? log : undefined
            );
          }
        }
        break;
      }
    }
  };

  p5._fesErrorMonitor = fesErrorMonitor;
  p5._checkForUserDefinedFunctions = checkForUserDefinedFunctions;

  // logger for testing purposes.
  p5._fesLogger = null;

  window.addEventListener('load', checkForUserDefinedFunctions, false);
  window.addEventListener('error', p5._fesErrorMonitor, false);

  /**
   * Prints out all the colors in the color pallete with white text.
   * For color blindness testing.
   */
  /* function testColors() {
    const str = 'A box of biscuits, a box of mixed biscuits and a biscuit mixer';
    report(str, 'print', '#ED225D'); // p5.js magenta
    report(str, 'print', '#2D7BB6'); // p5.js blue
    report(str, 'print', '#EE9900'); // p5.js orange
    report(str, 'print', '#A67F59'); // p5.js light brown
    report(str, 'print', '#704F21'); // p5.js gold
    report(str, 'print', '#1CC581'); // auto cyan
    report(str, 'print', '#FF6625'); // auto orange
    report(str, 'print', '#79EB22'); // auto green
    report(str, 'print', '#B40033'); // p5.js darkened magenta
    report(str, 'print', '#084B7F'); // p5.js darkened blue
    report(str, 'print', '#945F00'); // p5.js darkened orange
    report(str, 'print', '#6B441D'); // p5.js darkened brown
    report(str, 'print', '#2E1B00'); // p5.js darkened gold
    report(str, 'print', '#008851'); // auto dark cyan
    report(str, 'print', '#C83C00'); // auto dark orange
    report(str, 'print', '#4DB200'); // auto dark green
  } */
}

// This is a lazily-defined list of p5 symbols that may be
// misused by beginners at top-level code, outside of setup/draw. We'd like
// to detect these errors and help the user by suggesting they move them
// into setup/draw.
//
// For more details, see https://github.com/processing/p5.js/issues/1121.
misusedAtTopLevelCode = null;
const FAQ_URL =
  'https://github.com/processing/p5.js/wiki/p5.js-overview#why-cant-i-assign-variables-using-p5-functions-and-variables-before-setup';

defineMisusedAtTopLevelCode = () => {
  const uniqueNamesFound = {};

  const getSymbols = obj =>
    Object.getOwnPropertyNames(obj)
      .filter(name => {
        if (name[0] === '_') {
          return false;
        }
        if (name in uniqueNamesFound) {
          return false;
        }

        uniqueNamesFound[name] = true;

        return true;
      })
      .map(name => {
        let type;

        if (typeof obj[name] === 'function') {
          type = 'function';
        } else if (name === name.toUpperCase()) {
          type = 'constant';
        } else {
          type = 'variable';
        }

        return { name, type };
      });

  misusedAtTopLevelCode = [].concat(
    getSymbols(p5.prototype),
    // At present, p5 only adds its constants to p5.prototype during
    // construction, which may not have happened at the time a
    // ReferenceError is thrown, so we'll manually add them to our list.
    getSymbols(require('../constants'))
  );

  // This will ultimately ensure that we report the most specific error
  // possible to the user, e.g. advising them about HALF_PI instead of PI
  // when their code misuses the former.
  misusedAtTopLevelCode.sort((a, b) => b.name.length - a.name.length);
};

const helpForMisusedAtTopLevelCode = (e, log) => {
  if (!log) {
    log = console.log.bind(console);
  }

  if (!misusedAtTopLevelCode) {
    defineMisusedAtTopLevelCode();
  }

  // If we find that we're logging lots of false positives, we can
  // uncomment the following code to avoid displaying anything if the
  // user's code isn't likely to be using p5's global mode. (Note that
  // setup/draw are more likely to be defined due to JS function hoisting.)
  //
  //if (!('setup' in window || 'draw' in window)) {
  //  return;
  //}

  misusedAtTopLevelCode.some(symbol => {
    // Note that while just checking for the occurrence of the
    // symbol name in the error message could result in false positives,
    // a more rigorous test is difficult because different browsers
    // log different messages, and the format of those messages may
    // change over time.
    //
    // For example, if the user uses 'PI' in their code, it may result
    // in any one of the following messages:
    //
    //   * 'PI' is undefined                           (Microsoft Edge)
    //   * ReferenceError: PI is undefined             (Firefox)
    //   * Uncaught ReferenceError: PI is not defined  (Chrome)

    if (e.message && e.message.match(`\\W?${symbol.name}\\W`) !== null) {
      const symbolName =
        symbol.type === 'function' ? `${symbol.name}()` : symbol.name;
      if (typeof IS_MINIFIED !== 'undefined') {
        log(
          `Did you just try to use p5.js's ${symbolName} ${
            symbol.type
          }? If so, you may want to move it into your sketch's setup() function.\n\nFor more details, see: ${FAQ_URL}`
        );
      } else {
        log(
          translator('fes.misusedTopLevel', {
            symbolName,
            symbolType: symbol.type,
            link: FAQ_URL
          })
        );
      }
      return true;
    }
  });
};

// Exposing this primarily for unit testing.
p5.prototype._helpForMisusedAtTopLevelCode = helpForMisusedAtTopLevelCode;

if (document.readyState !== 'complete') {
  window.addEventListener('error', helpForMisusedAtTopLevelCode, false);

  // Our job is only to catch ReferenceErrors that are thrown when
  // global (non-instance mode) p5 APIs are used at the top-level
  // scope of a file, so we'll unbind our error listener now to make
  // sure we don't log false positives later.
  window.addEventListener('load', () => {
    window.removeEventListener('error', helpForMisusedAtTopLevelCode, false);
  });
}

export default p5;
