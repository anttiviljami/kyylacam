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
var exec = require('child_process').exec;

var motionbin = '/usr/bin/motion -c %s';
var motionconf = './motion.conf';

(function () {
  
  /*
   * Initalization function
   */
  function init() {
    console.log('Kyyla server starting...');
    
    // leave process running after script execution
    process.stdin.resume();

    // start motion daemon
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
   * Starts motion daemon
   */
  function startMotion(callback) {
    console.log('Starting motion...');
    exec(
      util.format(motionbin, motionconf), 
      function(error, stdout, stderr) {
        puts(error, stdout, stderr);
        typeof callback === 'function' ? callback() : null;  
      }
    );
  }

  function stopMotion(callback) {
    console.log('Stopping motion...');
    exec(
      'pkill motion', 
      function(error, stdout, stderr) {
        puts(error, stdout, stderr);
        typeof callback === 'function' ? callback() : null;  
      }
    );
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
