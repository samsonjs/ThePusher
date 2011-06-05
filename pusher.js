#!/usr/bin/env node

// ThePusher by Sami Samhuri 2011 MIT
//
// TODO:
//  - fork & run headless
//  - watch .pusher and automatically reload changes, rolling back on errors
//
// Possible TODOs, may be out of scope:
//  - mail output to MAILTO

var crypto = require('crypto')
  , fs = require('fs')
  , http = require('http')
  , querystring = require('querystring')
  , server = http.createServer(routeRequest)
  , serverOptions = { host: '127.0.0.1'
                    , port: 6177
                    , githubToken: sha1('pusher')
                    }

// why not export the pieces if someone wants to play around
module.exports =
{ serverOptions: serverOptions
, startServer: startServer
, stopServer: stopServer
, addTrigger: addTrigger
, parseLine: parseLine
, parseRefSpec: parseRefSpec
, routeRequest: routeRequest
, main: main
}

function sha1(s) {
  return crypto.createHash('sha1').update(s).digest('hex')
}

function main() {
  var path = require('path')
    , eachLine = require('batteries').fs.eachLine
    , rcFile = require('path').join(process.env.HOME, '.pusher')

  fs.stat(rcFile, function(err, s) {
    if (err) {
      spiel()
      return
    }
    eachLine(rcFile, { line: parseLine, end: startServer })
  })
}

var triggers = []

function addTrigger(t) { triggers.push(t) }

function parseLine(line) {
  // ignore comments and blank lines
  if (line.match(/^\s*(#.*|)?$/)) return

  line = line.trim() // don't want to match \s* everywhere

  var m

  // variables, host and port
  if (m = line.match(/^\s*([a-z]+)\s+(\S+)\s*$/i)) {
    var name = m[1].trim().toLowerCase()
      , val = m[2].trim()
    if (name === 'host' || name === 'port') {
      serverOptions[name] = val
    }
    else if (name === 'token') {
      serverOptions.githubToken = val
      process.env.PUSHER_GITHUB_TOKEN = val
    }
    else {
      console.warn('>>> unrecognized variable: ' + name + ' = ' + val)
    }
  }

  // <action> <ref type> <owner/repo:branch or tag> <command>
  else if (m = line.match(/^(create|delete|force|merge)\s+(branch|tag)\s+(\S+)\s+(.+)$/i)) {
    var action = m[1].toLowerCase()
      , refType = m[2].toLowerCase()
      , ref = parseRefSpec(m[3])
    if (refType === 'tag' && (action === 'force' || action === 'merge')) {
      throw new Error(action + ' is not supported with tags, try create or delete')
    }
    console.log('>>> ' + line)
    addTrigger({ action: action
               , refType: refType
               , refSpec: ref.spec
               , owner: ref.owner
               , repo: ref.repo
               , ref: ref.ref
               , command: m[4]
               })
  }

  // if you're happy and you know it, syntax error!
  else {
    throw new Error('syntax error: ' + line)
  }
}

// TODO run these things through git check-ref-format or do similar checks
function parseRefSpec(spec) {
  var result = { owner: '*', repo: '*', ref: '*' }
    , m
  // <owner/repo:ref>
  if (m = spec.match(/^([^\/]+)\/([^:]+):(\S+)$/)) {
    result.owner = m[1]
    result.repo = m[2]
    result.ref = m[3]
  }
  // <repo:ref>
  else if (m = spec.match(/^([^:]+):(\S+)$/)) {
    result.repo = m[1]
    result.ref = m[2]
  }
  // <owner/repo>
  else if (m = spec.match(/^([^\/]+)\/(\S+)$/)) {
    result.owner = m[1]
    result.repo = m[2]
  }
  // <ref>
  else {
    result.ref = spec
  }
  result.spec = result.owner + '/' + result.repo + ':' + result.ref
  return result
}

function textResponder(status, text) {
  var headers = { 'content-type': 'text/plain', 'content-length': (text || ''.length) }
  return function(req, res) {
    res.writeHead(status, headers)
    res.end(text)
  }
}

var notFound = textResponder(404, 'not found')
var badRequest = textResponder(400, 'bad request')

function parseRequest(req, cb) {
  var parts = []
  req.on('data', function(b) { parts.push(b) })
  req.on('end', function() {
    var body = parts.join('')
    try { 
      cb(null, JSON.parse(querystring.parse(body).payload))
    }
    catch (err) {
      err.body = body
      cb(err)
    }
  })
}

function routeRequest(req, res) {
  console.log([req.method, req.url, req.connection.remoteAddress, req.headers['content-length'], req.headers['content-type']].join(' '))
  if (req.url === '/' + serverOptions.githubToken && req.method === 'POST') {
    parseRequest(req, function(err, payload) {
      if (err) {
        console.error('!!! invalid json or missing payload: ' + err.body)
        console.error(err.message)
        console.error(err.stack)
        badRequest(req, res)
        return
      }

      res.writeHead(204)
      res.end()

      var action
        , owner = payload.repository.owner.name
        , repo = payload.repository.name
        , ref = payload.ref
        , branch = ref.match(/^refs\/heads\//) ? ref.split('/')[2] : null
        , tag = ref.match(/^refs\/tags\//) ? ref.split('/')[2] : null
        , refType = branch ? 'branch' : tag ? 'tag' : 'unknown'

      if (payload.created) {
        action = 'create'
      }
      else if (payload.deleted) {
        action = 'delete'
      }
      else if (payload.forced && branch) {
        action = 'force'
      }
      else {
        action = 'merge'
      }

      console.log('* ' + [action, refType, owner + '/' + repo + ':' + (branch || tag || ref)].join(' '))

      triggers.forEach(function(t) {
        if (t.action === action &&
            t.refType === refType &&
            (t.owner === '*' || t.owner === owner) &&
            (t.repo === '*' || t.repo === repo) && 
            (t.ref === '*' || t.ref === (branch || tag)))
        {
          console.log('>>> match: ', [t.action, t.refType, t.owner + '/' + t.repo + ':' + t.ref].join(' '))
          runCommand({ command: t.command
                     , action: action
                     , owner: owner
                     , repo: repo
                     , branch: branch
                     , tag: tag
                     , refType: refType
                     })
        }
      })
    })
  }
  else {
    notFound(req, res)
  }
}

function runCommand(options) {
  console.log('>>> running command: ' + options.command)
  var spawn = require('child_process').spawn
    // TODO quoting
    , args = options.command.split(/\s+/)
    , cmd = args.shift()
  process.env.PUSHER_ACTION = options.action || ''
  process.env.PUSHER_OWNER = options.owner || ''
  process.env.PUSHER_REPO = options.repo || ''
  process.env.PUSHER_REFTYPE = options.refType || ''
  process.env.PUSHER_BRANCH = options.branch || ''
  process.env.PUSHER_TAG = options.tag || ''
  var child = spawn(cmd, args)
  if (options.verbose) {
    child.stdout.on('data', function(b) { console.log('out>>> ' + b) })
    child.stderr.on('data', function(b) { console.log('err>>> ' + b) })
  }
}

function startServer() {
  server.listen(serverOptions.port, serverOptions.host)
}

function stopServer() {
  server.stop()
}

function spiel() {
  [ "ThePusher is a Github post-receive hook router."
  , ""
  , "Lines that begin with # are comments. No trailing comments."
  , ""
  , "ThePusher's config file resides at `~/.pusher` and looks like this:"
  , ""
  , "host github.samhuri.net"
  , "port 6177"
  , ""
  , "# a unique identifier used in the receive hook url"
  , "token e815fb07bb390b5e47e509fd1e31e0d82e5d9c24"
  , ""
  , "# a branch named \"feature\" is created"
  , "create branch feature notify-mailing-list.sh"
  , ""
  , "# any branch is deleted in a repo named \"my-project\""
  , "delete branch my-project:* notify-mailing-list.sh"
  , ""
  , "# commits are pushed to any branch on samsonjs/ThePusher, fast-forward merge"
  , "# (e.g. https://github.com/samsonjs/ThePusher)"
  , "merge branch samsonjs/ThePusher post-to-twitter.sh"
  , ""
  , "# someone force pushed to master in any of my projects"
  , "force branch samsonjs/*:master send-an-angry-email.sh"
  , ""
  , "# any tag is created in \"my-project\""
  , "create tag my-project:* build-tag.sh"
  , ""
  , "# any tag is deleted in \"my-project\""
  , "delete tag my-project:* delete-build-for-tag.sh"
  , ""
  , "Create ~/.pusher and run `thepusher` again."
  ].forEach(function(s) { console.log(s) })
}

if (require.main === module) main()
