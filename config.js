/* eslint no-console: 0 */  // --> OFF
var nconf = require('nconf');
var winston = require('winston');
var path = require('path');

nconf.env(['USER','LOG_LEVEL','LOG_FOLDER'])
   .file('config',path.join(__dirname, './config/config.json'))
   .file('common',path.join(__dirname, './config/config.common.json'))
var options = {};

var logFilePath = nconf.get('LOG_FILE_PATH');
var user = nconf.get('USER');
if (user) options.user = user;
var logLevel = nconf.get('LOG_LEVEL');
options.publisher = nconf.get('publisher');
options.kinesis = nconf.get('kinesis');
options.eventsGenerator = nconf.get('eventsGenerator');

var logger;
if (!logLevel) {
    logLevel = 'VERBOSE';
}

logger = require('./config/winston.config.js')(winston,logLevel,['file'],logFilePath);
global.appLogger = logger;
module.exports = {
    DEFAULTS: options,
    EVENTS: nconf.get('events')
};
