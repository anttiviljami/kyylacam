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
var rmdir = require('rimraf');

/*
 * Global variables
 */
var args = process.argv;
var verbose = args.indexOf('-v') != -1
            || args.indexOf('--verbose') != -1;

var motion;
var frames = [];
var eid;

/*
 * Config
 */
var motioncmd = 'motion';
var motionconf = './motion.conf';
var comparecmd = 'compare -metric AE -fuzz 20% %s %s null';
var alertcmd = '/bin/bash ./alert.sh';

/*
 * Initalization 
 */
function init() {
  log('Kyyla server starting...', 'always');
  
  // leave process running after script execution
  process.stdin.resume();

  // clear old captures
  rmdir('capture', function(error){});

  // start motion
  startMotion();
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
      // 
    }

    if(response.action ===  'picture_save') {
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
  log('Event: ' + response.eventid, 'always')
}


/*
 * No movement for x amount of seconds
 */
function onMovementEnd(response) {
  log('Motion Ended', 'always');
  log('Event: ' + response.eventid, 'always')
}

/*
 * Triggers when a picture is saved
 */
function onPictureSave(response) {
  
  eid = parseInt(response.eventid);
  if(frames[eid] === undefined) {
    frames[eid] = [];
    var compare = eid > 1;
  }

  frames[eid].push(response.img);
  log('Image captured: ' + _.last(frames[eid]), 'always');
  log('Event: ' + response.eventid, 'always');

  if(compare) {
    // compare first frames of previous and current events
    compareFrames(_.first(frames[eid - 1]), _.first(frames[eid]));

    // drop the snapshot comparison frame
    frames[eid].splice(0, 1);
  }
  
}

/*
 * Compares two images and outputs the distortion
 */
function compareFrames(before, after) {
  log('Comparing frames...', 'always');
  //log('before:' + before, 'always');
  //log('after:' + after, 'always');
  var cmd = util.format(comparecmd, before, after);
  
  //log(cmd, 'always');
  exec(cmd, function(error, stdout, stderr) {
    var result = parseInt(stderr + '');

    log('Distortion: ' + result, 'always');

    if(result > 0) {
      // scene has changed, run alert
      onSceneChange(); 
    } 

    else {
      // scene hasn't changed
      log('No changes to scene detected.', 'always');
    }
    // puts(error, stdout, stderr);
  });
}

/*
 * When a scene change has been detected
 */
function onSceneChange() {
  log('Scene change detected!', 'always');
  log('Event: ' + eid, 'always');
  
  // run the alert command
  exec(alertcmd, puts);
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
process.on('exit', exitHandler.bind(null,{cleanup:true}));
process.on('SIGINT', exitHandler.bind(null, {exit:true}));
process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
function exitHandler(options, err) {

  // clean up
  if (options.cleanup) {
    // stop the motion child process
    log('Stopping motion tracking and exiting...')
    motion.kill();
    process.exit();
  }
  
  if (err) log(err.stack);
  if (options.exit) process.exit();
}

init();

