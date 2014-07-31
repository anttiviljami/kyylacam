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

var motion;
var motioncmd = '/usr/bin/motion';
var motionconf = './motion.conf';

(function () {
  
  /*
   * Initalization function
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
   * Starts motion
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
      process.stdout.write(data);
    });

    motion.stderr.on('data', function (data) {
      //process.stdout.write('stderr: ' + data);
    });

    motion.on('close', function (code) {
      console.log('motion exited with code ' + code);
    });

  }

  function stopMotion(callback) {
    // kill the process
    motion.kill();
  }

  /*
   * Termination handling
   */
  process.on('exit', exitHandler.bind(null,{cleanup:true}));
  process.on('SIGINT', exitHandler.bind(null, {exit:true}));
  process.on('uncaughtException', exitHandler.bind(null, {exit:true}));
  function exitHandler(options, err) {

    // clean up
    if (options.cleanup) {
      // stop the motion daemon
      stopMotion();
      process.exit();
    }
    
    if (err) console.log(err.stack);
    if (options.exit) process.exit();
  }

  init();
})();
