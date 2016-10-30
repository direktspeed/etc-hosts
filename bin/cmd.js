#!/usr/bin/env node

/*
New flow is readlines into array make array entry1 array
if array length bigger then 1 item remove item
if array length = 1 remove line
if add exists in other line add extra line for it
create flag for set cmd append -a -n new
also add Mark disabled enabled.
lets use commander



*/

var chalk = require('chalk')
var hostile = require('../')
var minimist = require('minimist')

var IP_RE = /^(([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)\.){3}([1-9]?\d|1\d\d|2[0-5][0-5]|2[0-4]\d)$/

var argv = minimist(process.argv.slice(2))

var command = argv._[0]

if (command === 'list' || command === 'ls') list()
if (command === 'set') set(argv._[1], argv._[2])
if (command === 'remove') remove(argv._[1])
if (!command) help()

/**
 * Print help message
 */
function help () {
  console.log(function () { /*
  Usage: hostile [command]

    Commands:

      list                   List all current domain records in hosts file
      set [ip] [host]        Set a domain in the hosts file
      remove [domain]        Remove a domain from the hosts file

  */ }.toString().split(/\n/).slice(1, -1).join('\n'))
}

function isUndefined(val) {
  return typeof val === 'undefined'
}

function isString(val) {
  return typeof val === 'string'
}

function isObject(val) {
  return val !== null && typeof val === 'object'
}

function parse(hosts, opt) {
  if (!isString(hosts)) {
    throw new Error('Parse\'s first param should be a string')
  }

  if (!isObject(opt)) {
    opt = {}
  }

  return hosts.split('\n')
    .filter(function (str) { // remove blank line
      return /\s*/.test(str)
    })
    .map(function (line) {
      return line.trim().split(/\s+/)
    })
    .reduce(function (obj, line) {
      var ip = line[0]
      var names = line.slice(1)
      var nameObj = names.reduce(function (ob, name) {
        return Object.assign(ob, { [name]: ip })
      }, {})

      return Object.assign(obj, nameObj)
    }, {})
}

function stringify(json, opt) {
  if (!isObject(json)) {
    throw new Error('Stringify\'s first param should be an object')
  }

  if (!isObject(opt)) {
    opt = {}
  }

  if (isUndefined(opt.seperate)) {
    opt.seperate = ' '
  }

  return Object.keys(json)
    .map(function (key) {
      return json[key] + opt.seperate + key
    })
    .join('\n')
}

exports.parse = parse
exports.stringify = stringify

/**
 * Display all current ip records
 */
function list () {
  var lines
  try {
    lines = hostile.get(false)
  } catch (err) {
    return error(err)
  }
  lines.forEach(function (item) {
    if (item.length > 1) {
      console.log(item[0], chalk.green(item[1]))
    } else {
      console.log(item)
    }
    
  })
}

/**
 * Set a new host
 * @param {string} ip
 * @param {string} host
 */
function set (ip, host) {
  if (!ip || !host) {
    return error('Invalid syntax: hostile set <ip> <host>')
  }

  if (ip === 'local' || ip === 'localhost') {
    ip = '127.0.0.1'
  } else if (!IP_RE.test(ip)) {
    return error('Invalid IP address')
  }

  try {
    hostile.set(ip, host)
  } catch (err) {
    return error('Error: ' + err.message + '. Are you running as root?')
  }
  console.log(chalk.green('Added ' + host))
}

/**
 * Remove a host
 * @param {string} host
 */
function remove (host) {
  var lines
  try {
    lines = hostile.get(false)
  } catch (err) {
    return error(err)
  }
  lines.forEach(function (item) {
    item[1] = item[1].split(' ')
    if (item[1].indexOf(host) > -1) {
      try {
        hostile.remove(item[0], host)
      } catch (err) {
        return error('Error: ' + err.message + '. Are you running as root?')
      }
      console.log(chalk.green('Removed ' + host))
    }
  })
}

/**
 * Print an error and exit the program
 * @param {string} message
 */
function error (err) {
  console.error(chalk.red(err.message || err))
  process.exit(-1)
}
