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


var fs = require('fs')
var once = require('once')
var split = require('split')
var through = require('through')

var WINDOWS = process.platform === 'win32'
var EOL = WINDOWS
  ? '\r\n'
  : '\n'

exports.HOSTS = WINDOWS
  ? 'C:/Windows/System32/drivers/etc/hosts'
  : '/etc/hosts'

/**
 * Get a list of the lines that make up the /etc/hosts file. If the
 * `preserveFormatting` parameter is true, then include comments, blank lines
 * and other non-host entries in the result.
 *
 * @param  {boolean}   preserveFormatting
 * @param  {function(err, lines)=} cb
 */
function hostileGet(preserveFormatting, cb) {
  var lines = []
  if (typeof cb !== 'function') {
    fs.readFileSync(exports.HOSTS, { encoding: 'utf8' }).split(/\r?\n/).forEach(online)
    return lines
  }

  cb = once(cb)
  fs.createReadStream(exports.HOSTS, { encoding: 'utf8' })
    .pipe(split())
    .pipe(through(online))
    .on('close', function () {
      cb(null, lines)
    })
    .on('error', cb)

  function online (line) {
    var matches = /^\s*?([^#]+?)\s+([^#]+?)$/.exec(line)
    if (matches && matches.length === 3) {
      // Found a hosts entry
      var ip = matches[1]
      var host = matches[2]
      lines.push([ip, host])
    } else {
      // Found a comment, blank line, or something else
      if (preserveFormatting) {
        lines.push(line)
      }
    }
  }
}
exports.get = hostileGet
/**
 * Add a rule to /etc/hosts. If the rule already exists, then this does nothing.
 *
 * @param  {string}   ip
 * @param  {string}   host
 * @param  {function(Error)=} cb
 */
function hostileSet(ip, host, cb) {
  var didUpdate = false
  if (typeof cb !== 'function') {
    return _set(exports.get(true))
  }

  exports.get(true, function (err, lines) {
    if (err) return cb(err)
    _set(lines)
  })

  function _set (lines) {
    // Try to update entry, if host already exists in file
    lines = lines.map(mapFunc)

    // If entry did not exist, let's add it
    if (!didUpdate) {
      // If the last line is empty, or just whitespace, then insert the new entry
      // right before it
      var lastLine = lines[lines.length - 1]
      if (typeof lastLine === 'string' && /\s*/.test(lastLine)) {
        lines.splice(lines.length - 1, 0, [ip, host])
      } else {
        lines.push([ip, host])
      }
    }

    exports.writeFile(lines, cb)
  }

  function mapFunc (line) {
    if (Array.isArray(line) && line[1] === host) {
      line[0] = ip
      didUpdate = true
    }
    return line
  }
}
exports.set = hostileSet
/**
 * Remove a rule from /etc/hosts. If the rule does not exist, then this does
 * nothing.
 *
 * @param  {string}   ip
 * @param  {string}   host
 * @param  {function(Error)=} cb
 */
function hostileRemove(ip, host, cb) {
  if (typeof cb !== 'function') {
    return _remove(exports.get(true))
  }

  exports.get(true, function (err, lines) {
    if (err) return cb(err)
    _remove(lines)
  })

  function _remove (lines) {
    // Try to remove entry, if it exists
    lines = lines.filter(filterFunc)
    return exports.writeFile(lines, cb)
  }

  function filterFunc (line) {
    return !(Array.isArray(line) && line[0] === ip && line[1] === host)
  }
}
exports.remove =hostileRemove
/**
 * Write out an array of lines to the host file. Assumes that they're in the
 * format that `get` returns.
 *
 * @param  {Array.<string|Array.<string>>} lines
 * @param  {function(Error)=} cb
 */
function writeFile(lines, cb) {
  lines = lines.map(function (line, lineNum) {
    if (Array.isArray(line)) {
      line = line[0] + ' ' + line[1]
    }
    return line + (lineNum === lines.length - 1 ? '' : EOL)
  })

  if (typeof cb !== 'function') {
    var stat = fs.statSync(exports.HOSTS)
    fs.writeFileSync(exports.HOSTS, lines.join(''), { mode: stat.mode })
    return true
  }

  cb = once(cb)
  fs.stat(exports.HOSTS, function (err, stat) {
    if (err) {
      return cb(err)
    }
    var s = fs.createWriteStream(exports.HOSTS, { mode: stat.mode })
    s.on('close', cb)
    s.on('error', cb)

    lines.forEach(function (data) {
      s.write(data)
    })
    s.end()
  })
}
exports.writeFile = writeFile

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
    hostileSet(ip, host)
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
    lines = hostileGet(false)
  } catch (err) {
    return error(err)
  }
  lines.forEach(function (item) {
    item[1] = item[1].split(' ')
    if (item[1].indexOf(host) > -1) {
      try {
        hostileRemove(item[0], host)
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
