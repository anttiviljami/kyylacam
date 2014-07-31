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

/*
 * Global variables
 */
var args = process.argv;
var verbose = args.indexOf('-v') != -1
            || args.indexOf('--verbose') != -1;
var motion;


/*
 * Config
 */
var motioncmd = '/usr/bin/motion';
var motionconf = './motion.conf';


/*
 * Initalization 
 */
function init() {
  console.log('Kyyla server starting...');
  
  // leave process running after script execution
  process.stdin.resume();

  // start motion
  startMotion();
}

/*
 * Helper function that can be passed to exec calls for verbose output
 */
function puts(error, stdout, stderr) { 
  console.log(stderr);
  if (error !== null) {
    console.log('exec error: ' + error);
  }
}

/*
 * Launches motion tracking
 */
function startMotion(callback) {
  console.log('Starting motion...');
  
  // spawn child process
  motion = spawn(
    motioncmd, 
    ['-c', motionconf]
  );

  // event handlers for motion
  motion.stdout.on('data', function (data) {
    
    if(verbose)
        process.stdout.write(data);
    
    if(/event_start/.test(data)) {
      onMovementStart();
    }

    if(/event_end/.test(data)) {
      onMovementEnd();
    }
    
  });

  motion.stderr.on('data', function (data) {
    
    if(verbose)
      process.stderr.write(data);
    
    if(/Started\ stream\ webcam\ server/.test(data)) {
      console.log("Ready.")
    }

    if(/Permission denied/.test(data)) {
      process.stderr.write(data);
      console.log('Now exiting...');
      process.exit();
    }

  });

  motion.on('close', function (code) {
    process.stderr.write('motion exited with code ' + code + '\r');
    process.exit();
  });

}

/*
 * Triggers when movement begins
 */
function onMovementStart() {
  console.log("Motion Started!");
}

/*
 * No movement for x amount of seconds
 */
function onMovementEnd() {
  console.log("Motion Ended");
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
    // stop the motion daemon
    console.log('Stopping motion and exiting...')
    motion.kill();
    process.exit();
  }
  
  if (err) console.log(err.stack);
  if (options.exit) process.exit();
}

init();
