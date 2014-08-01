/**
 * Filename: kyyla.js
 * Project: Kyylacam
 * Copyright: (c) 2014 Antti Kuosmanen
 * License: The MIT License (MIT) http://opensource.org/licenses/MIT
 *
 * A node.js kitchen sink surveillance robot for the Raspberry Pi
 */

var sys = require('sys');
var util = require('util');
var child_process = require('child_process'),
    exec = child_process.exec,
    spawn = child_process.spawn;

var _ = require('underscore');
var hid = require('hidstream');
var rmdir = require('rimraf');


/*
 * Config
 */
var eventFuzz = '20%';
var referenceFuzz = '20%';
var motioncmd = 'motion';
var motionconf = './motion.conf';
var comparecmd = 'compare -metric AE -fuzz %s %s %s /dev/null';
var alertcmd = '/bin/bash ./alert.sh';
var resetkey = 40; // keycode with which you can reset reference frame
var snapshotcmd = 'wget --quiet -O /dev/null 127.0.01:8080/0/action/snapshot';


/*
 * Global variables
 */
var args = process.argv;
var verbose = args.indexOf('-v') != -1
            || args.indexOf('--verbose') != -1;

var Keyboard;
var motion;
var frames = [];
var eid;
var referenceFrame;
var setref = false;

/*
 * Initalization 
 */
function init() {
  log('Kyyla server starting...', 'always');
  
  // leave process running after script execution
  process.stdin.resume();

  // clear old captures
  rmdir('capture', function(error){});

  // init keyboard
  initKeyboard();

  // start motion
  startMotion();
}

/*
 * Initalize keyboard listener 
 */
function initKeyboard() {
  // get keyboard access
  var path = hid.getDevices()[0].path;
  Keyboard = new hid.device(path);

  Keyboard.on("data", function(dat) {
    // console.log(dat); 
    if(dat.keyCodes.indexOf(40) != -1) {
      // Return key pressed
      setReference();
    }
  });
}

/*
 * Sets / Resets reference frame
 */
function setReference() {
  log('Setting reference frame...', 'always');

  // take snapshot
  exec(snapshotcmd, function() {
    setref = true;
  });
}

/*
 * Launches motion tracking
 */
function startMotion() {
  log('Starting motion tracking...', 'always');
  
  // spawn a motion child process
  motion = spawn(
    motioncmd, 
    ['-c', motionconf]
  );

  // event handlers for motion triggered by output
  motion.stdout.on('data', function (data) {
    
    if(verbose)
        process.stdout.write(data);

    try {
      var response = JSON.parse(data + '');
    }

    catch (e) {
      process.stderr.write('Is the JSON valid?: ' + data);
    }

    if(response.action === 'event_start') {
      // trigger onMovementStart event
      onMovementStart(response);
    }

    if(response.action ===  'event_end') {
      // trigger onMovementEnd event
      onMovementEnd(response);
    }

    if(response.action ===  'motion_detected') {
      // trigger onMotionDetect event
      onMotionDetect(response);
    }

    if(response.action ===  'picture_save') {
      // trigger onPictureSave event
      onPictureSave(response);
    }
    
  });

  motion.stderr.on('data', function (data) {
    
    if(verbose)
      process.stderr.write(data);
    
    // Motion has launched
    if(/Started\ stream\ webcam\ server/.test(data)) {
      log("Ready.", 'always');
    }

    // An error has occured
    if(/error/i.test(data)) {
      process.stderr.write(data);
      log('Now exiting...', 'always');
      process.exit();
    }

  });

  // TODO: does this work?
  motion.on('close', function (code) {
    process.stderr.write('motion exited with code ' + code + '\r');
    process.exit();
  });

}


/*
 * Triggers when movement begins
 */
function onMovementStart(response) {
  log('Motion Started!', 'always');
}


/*
 * No movement for x amount of seconds
 */
function onMovementEnd(response) {
  log('Motion Ended', 'always');
}

/*
 * No movement for x amount of seconds
 */
function onMotionDetect(response) {
  log('Detecting motion...', 'always');
}

/*
 * Triggers when a picture is saved
 */
function onPictureSave(response) {
  
  if(!setref) {
    eid = parseInt(response.eventid);
    if(frames[eid] === undefined) {
      frames[eid] = [];
      var compare = eid > 1;
    }

    frames[eid].push(response.img);
    log('Image captured: ' + _.last(frames[eid]));

    if(compare) {
      // compare first frames of previous and current events
      compareFrames(_.first(frames[eid - 1]), _.first(frames[eid]), eventFuzz);

      // drop the snapshot comparison frame
      frames[eid].splice(0, 1);
    }
  } 

  else {
    // setting reference frame
    setref = false;
    referenceFrame = response.img;
    log('ReferenceFrame set to: ' + referenceFrame, 'always');
  }
  
}

/*
 * Compares two images and outputs the distortion
 */
function compareFrames(before, after, fuzz) {
  
  log('Comparing frames...', 'always');
  var cmd = util.format(comparecmd, fuzz, before, after);
  
  log(cmd);
  exec(cmd, function(error, stdout, stderr) {
    var result = parseInt(stderr + '');

    log('Distortion: ' + result, 'always');

    if(result > 0) {
      // scene has changed, run alert
      onSceneChange(after); 
    } 

    else {
      // scene hasn't changed
      log('OK. No changes to scene detected.', 'always');
    }
    // puts(error, stdout, stderr);
  });
}

/*
 * Compares a frame to reference image with possibly different lighting
 */
function compareFramesRef(before, after, fuzz) {
  
  log('Comparing frames...', 'always');
  var cmd = util.format(comparecmd, fuzz, before, after);
  
  log(cmd);
  exec(cmd, function(error, stdout, stderr) {
    var result = parseInt(stderr + '');

    log('Distortion: ' + result, 'always');

    if(result > 0) {
      // run the alert command
      log('Changes detected. Run alert sequence.');
      exec(alertcmd, puts);
    } 

    else {
      // scene hasn't changed
      log('OK. No changes to reference scene detected.', 'always');
    }
    // puts(error, stdout, stderr);
  });
}

/*
 * When a scene change has been detected
 */
function onSceneChange(after) {
  log('Scene change detected!', 'always');

  //
  if(referenceFrame !== undefined) {
    log('Comparing to reference frame...', 'always');
    compareFramesRef(referenceFrame, after, referenceFuzz);
  }
  else {
    log('Reference frame not set. Proceeding...');
    log('Keypress ' + resetkey + ' required on host to set reference frame.')
  }

}

/*
 * Helper function that can be passed to exec calls for verbose output
 */
function puts(error, stdout, stderr) { 
  if(stdout.length)
    process.stdout.write(stdout);
  if(stderr.length)
    process.stderr.write('Error: ' + stderr);
  if (error !== null) 
    log(error, 'always');
}

/*
 * Verbose mode dependant logging
 */
function log(input, mode) {
  if (verbose || mode === 'always')
    console.log(input);
}

/*
 * Termination handling and clean up
 */
process.on('exit', exitHandler);
process.on('SIGINT', exitHandler);
process.on('uncaughtException', exitHandler);
function exitHandler(err) {
  log("Stopping motion detection and exiting...");
  
  // close keyboard HID to prevent process from hanging
  Keyboard.device.close();

  // kill motion child process
  motion.kill();

  // kill main process
  process.exit();
}

init();
