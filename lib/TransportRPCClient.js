'use strict'

const request = require('request')
const assert = require('assert')

const _ = require('lodash')
const Base = require('grenache-nodejs-base')

class TransportRPCClient extends Base.TransportRPCClient {
  constructor (client, conf) {
    super(client, conf)

    this.conf = conf
    this.init()
  }

  init () {
    super.init()

    this.socket = this.getSocket(this.conf.secure)
  }

  getSocket (secure) {
    if (!secure) {
      return request
    }

    assert(Buffer.isBuffer(secure.key), 'conf.secure.key must be a Buffer')
    assert(Buffer.isBuffer(secure.cert), 'conf.secure.cert must be a Buffer')
    assert(Buffer.isBuffer(secure.ca), 'conf.secure.ca must be a Buffer')

    return request
  }

  getOpts (postData, opts, secure) {
    const u = secure
      ? ('https://' + this.conf.dest) : ('http://' + this.conf.dest)

    const def = {
      body: postData,
      url: u,
      path: '/',
      method: 'POST'
    }

    if (!secure) {
      return _.extend(def, opts)
    }

    return _.extend(def, opts, secure)
  }

  request (key, payload, opts, cb) {
    this._request(key, payload, opts, cb)
  }

  sendRequest (req) {
    const postData = this.format([req.rid, req.key, req.payload])

    this.post({
      timeout: req.opts.timeout
    }, postData, (err, body) => {
      if (err) {
        this.handleReply(req.rid, new Error(`ERR_REQUEST_GENERIC: ${err.message}`))
        return
      }

      const data = this.parse(body)

      if (!data) {
        this.handleReply(req.rid, new Error('ERR_REPLY_EMPTY'))
        return
      }

      const [rid, _err, res] = data
      this.handleReply(rid, _err ? new Error(_err) : null, res)
    })
  }

  post (_opts, postData, _cb) {
    const socket = this.socket
    const opts = this.getOpts(postData, _opts, this.conf.secure)

    let isExecuted = false

    const cb = (err, body) => {
      if (isExecuted) return
      isExecuted = true
      _cb(err, body)
    }

    const req = socket.post(opts, (err, res, body) => {
      if (err) {
        return cb(err)
      }

      cb(null, body)
    })

    req.on('error', (err) => {
      cb(err)
    })
  }
}

module.exports = TransportRPCClient
