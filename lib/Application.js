/**
 * Dependencies.
 */

var events = require('events');
var util = require('util');
var debug = require('debug')('protoo:Application');
var PeerManager = require('./PeerManager');
var WebSocketServer = require('./WebSocketServer');


/**
 * Emitted events.
 *
 *
 * 'error'
 *
 * Fired upon an usage or internal error.
 *
 * @event error
 * @param {Error} error.
 *
 *
 * 'ws:connecting'
 *
 * Fired upon a WebSocket connection attempt.
 *
 * @event ws:connecting
 * @param {Object} connectingInfo
 * @param {http.IncomingRequest} connectingInfo.req  The HTTP request of the client handshake.
 * @param {String} connectingInfo.origin  The Origin header value in the client request (may be `null`).
 * @param {Function} acceptCb  Callback the user must invoke to accept the connection by providing information about the connected peer.
 * @param {String} acceptCb.username  Username of the peer.
 * @param {String} acceptCb.uuid  UUID of the peer.
 * @param {Object} acceptCb.data  Custom data for this peer.
 * @param {Function} rejectCb  Callback the user must invoke to reject the connection.
 * @param {Number} rejectCb.code  Rejection cause code.
 * @param {String} rejectCb.reason  Rejection description.
 * @param {Function} waitCb  Callback the user must invoke to announce that it will call `acceptCb` or `rejectCb` later (maybe after a DB query or whatever asynchronous operation).
 *
 *
 * 'peer:online'
 *
 * Emitted when a peer has connected.
 *
 * @event 'peer:online'
 * @param {Peer} peer  The connected Peer instance.
*
*
* 'peer:offline'
*
* Emitted when a peer has disconnected.
*
* @event 'peer:offline'
* @param {Peer} peer  The disconnected Peer instance.
 */


/**
 * The application the user is provided with.
 *
 * @class Application
 * @constructor
 */

var Application = function() {
	debug('new');

	events.EventEmitter.call(this);

	// The PeerManager instance.
	this.peerManager = new PeerManager(this);

	this.peerManager.on('error', function(error) {
		debug('PeerManager emits "error" event');
		this.error(error);
	}.bind(this));

	// The servers container.
	this.servers = [];
};

util.inherits(Application, events.EventEmitter);


/**
 * Handle WebSocket connections.
 *
 * @method handleWebSocket
 * @param {http.Server|https.Server} httpServer A Node HTTP or HTTPS server.
 * @chainable
 */

Application.prototype.handleWebSocket = function(httpServer) {
	debug('handleWebSocket()');

	var wsServer = new WebSocketServer(this, httpServer);

	wsServer.on('error', function(error) {
		debug('WebSocketServer emits "error" event');
		this.error(error);
	}.bind(this));

	this.servers.push(wsServer);
	return this;
};


/**
 * Close the application and disconnect peers.
 *
 * @method close
 * @param {Boolean} [closeServers=false] Close the server(s) instead of just
 * disabling them.
 */

Application.prototype.close = function(closeServers) {
	debug('close()');

	// Disconnect all the peers.
	// TODO: code should be an enum and then translate to a code
	// for each kind of connection.
	this.peerManager.close(1001, 'shutting down');

	// Close the servers.
	this.servers.forEach(function(server) {
		server.close(closeServers);
	});
};


/**
 * Private API
 */

/**
 * Make the application emit an event.
 *
 * @method fire
 * @private
 * @return {Boolean} `true` if no error raised, `false` otherwise.
 */

Application.prototype.fire = function() {
	var event = arguments[0];

	try {
		debug('emitting "%s" event', event);
		this.emit.apply(this, arguments);
		return true;
	}
	catch(error) {
		debug('error catched during "%s" event', event);
		this.error(error);
		return false;
	}
};


/**
 * Make the application emit an 'error' event or throw it if the application has
 * not an 'error' handler.
 *
 * @method error
 * @private
 */

Application.prototype.error = function(error) {
	debug(error);

	if (this.listeners('error').length === 0) {
		debug('no "error" handler, throwing error');
		throw error;
	}

	debug('emitting "error" event');
	this.emit('error', error);
};



/**
 * Expose the Application class.
 */

Object.freeze(Application);
module.exports = Application;