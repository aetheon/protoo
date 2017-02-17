'use strict';

const EventEmitter = require('events').EventEmitter;
const logger = require('./logger')('Peer');
const Message = require('./Message');

// Max time waiting for a response.
const REQUEST_TIMEOUT = 10000;

class Peer extends EventEmitter
{
	constructor(peerId, transport)
	{
		logger.debug('constructor()');

		super();
		this.setMaxListeners(Infinity);

		// Peer id.
		this._id = peerId;

		// Transport.
		this._transport = transport;

		// Closed flag.
		this._closed = false;

		// Map of sent requests' handlers indexed by request.id.
		this._requestHandlers = new Map();

		// Handle transport.
		this._handleTransport();
	}

	get closed()
	{
		return this._closed;
	}

	get id()
	{
		return this._id;
	}

	close()
	{
		logger.debug('close()');

		if (this._closed)
			return;

		this._closed = true;

		// Close transport.
		this._transport.close();

		// Close every pending request handler.
		this._requestHandlers.forEach((handler) => handler.close());

		// Emit 'close' event.
		this.emit('close');
	}

	send(method, data)
	{
		let request = Message.requestFactory(method, data);

		return new Promise((pResolve, pReject) =>
		{
			let handler =
			{
				resolve : (data) =>
				{
					if (!this._requestHandlers.delete(request.id))
						return;

					clearTimeout(handler.timer);
					pResolve(data);
				},

				reject : (error) =>
				{
					if (!this._requestHandlers.delete(request.id))
						return;

					clearTimeout(handler.timer);
					pReject(error);
				},

				timer : setTimeout(() =>
				{
					if (!this._requestHandlers.delete(request.id))
						return;

					pReject(new Error('request timeout'));
				}, REQUEST_TIMEOUT),

				close : () =>
				{
					clearTimeout(handler.timer);
					pReject(new Error('peer closed'));
				}
			};

			// Add handler stuff to the Map.
			this._requestHandlers.set(request.id, handler);
		});
	}

	_handleTransport()
	{
		this._transport.on('close', () =>
		{
			if (this._closed)
				return;

			this._closed = true;

			// Emit 'close' event.
			this.emit('close');
		});

		this._transport.on('message', (message) =>
		{
			if (message.response)
			{
				this._handleResponse(message);
			}
			else if (message.request)
			{
				this._handleRequest(message);
			}
		});
	}

	_handleResponse(response)
	{
		let handler = this._requestHandlers.get(response.id);

		if (!handler)
		{
			logger.error('received response does not match any sent request');
			return;
		}

		if (response.ok)
		{
			handler.resolve(response.data);
		}
		else
		{
			let error = new Error(response.errorReason);

			error.code = response.errorCode;
			handler.reject(error);
		}
	}

	_handleRequest(request)
	{
		this.emit('request',
			// Request.
			request,
			// accept() function.
			(data) =>
			{
				let response = Message.successResponseFactory(request, data);

				this._transport.send(response);
			},
			// reject() function.
			(errorReason, errorCode) =>
			{
				let response = Message.errorResponseFactory(request, errorReason, errorCode);

				this._transport.send(response);
			});
	}
}

module.exports = Peer;