/*******************************************************************************
 * @license
 * Copyright (c) 2012 IBM Corporation and others.
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors: IBM Corporation - initial API and implementation
 ******************************************************************************/
/*global define*/
define([], function() {

	var CLOSED = 0, OPENED = 1;
	/**
	 * @name orion.ServiceTracker
	 * @class Simplifies the use of services within a service registry.
	 * @description A ServiceTracker tracks matching services in the given service registry. Matching services are those
	 * whose <code>objectClass</code> property contains the given <code>serviceName</code>. The {@link #addingService} and 
	 * {@link #removedService} methods can be overridden to customize the service objects being tracked.
	 * @param {orion.serviceregistry.ServiceRegistry} serviceRegistry The service registry to track services of.
	 * @param {String} serviceName The service name of services to be tracked.
	 */
	function ServiceTracker(serviceRegistry, serviceName) {
		this.serviceRegistry = serviceRegistry;
		var refs = {};
		var services = {};
		var state = CLOSED;
		var addedListener, removedListener;

		function add(serviceRef) {
			var id = serviceRef.getProperty('service.id');
			var serviceObject = this.addingService(serviceRef);
			if (serviceObject) {
				refs[id] = serviceRef;
				services[id] = serviceObject;
			}
		}
		function remove(serviceRef) {
			var id = serviceRef.getProperty('service.id');
			var service = services[id];
			delete refs[id];
			delete services[id];
			this.removedService(serviceRef, service);
		}
		function isTrackable(serviceRef) {
			return serviceRef.getProperty('objectClass').indexOf(serviceName) !== -1; //$NON-NLS-0$
		}

		/**
		 * Stops tracking services.
		 * @name orion.ServiceTracker#close
		 * @function
		 */
		this.close = function() {
			if (state !== OPENED) {
				throw 'Already closed'; //$NON-NLS-0$
			}
			state = CLOSED;
			serviceRegistry.removeEventListener('registered', addedListener); //$NON-NLS-0$
			serviceRegistry.removeEventListener('unregistering', removedListener); //$NON-NLS-0$
			addedListener = null;
			removedListener = null;
			var self = this;
			this.getServiceReferences().forEach(function(serviceRef) {
				remove.call(self, serviceRef);
			});
			if (typeof this.onClose === 'function') {
				this.onClose();
			}
		};
		/**
		 * Returns service references to the services that are being tracked.
		 * @name orion.ServiceTracker#getServiceReferences
		 * @function
		 * @returns {orion.serviceregistry.ServiceReference[]} References to all services that are being tracked by this ServiceTracker.
		 */
		this.getServiceReferences = function() {
			if (refs.length) {
				return Object.keys(refs).map(function(serviceId) {
					return refs[serviceId];
				});
			}
			return null;
		};
		/**
		 * Begins tracking services.
		 * @name orion.ServiceTracker#open
		 * @function
		 */
		this.open = function() {
			if (state !== CLOSED) {
				throw 'Already open'; //$NON-NLS-0$
			}
			state = OPENED;
			var self = this;
			addedListener = /** @ignore */ function(event) {
				if (isTrackable(event.serviceReference)) {
					add.call(self, event.serviceReference);
					if (typeof self.onServiceAdded === 'function') {
						return self.onServiceAdded(event.serviceReference, self.serviceRegistry.getService(event.serviceReference));
					}
				}
			};
			removedListener = /** @ignore */ function(event) {
				if (isTrackable(event.serviceReference)) {
					remove.call(self, event.serviceReference);
				}
			};
			serviceRegistry.addEventListener('registered', addedListener); //$NON-NLS-0$
			serviceRegistry.addEventListener('unregistering', removedListener); //$NON-NLS-0$
			serviceRegistry.getServiceReferences(serviceName).forEach(function(serviceRef) {
				add.call(self, serviceRef);
			});
			if (typeof this.onOpen === 'function') {
				this.onOpen();
			}
		};
	}
	ServiceTracker.prototype = {
		/**
		 * Called to customize a service object being added to this ServiceTracker. Subclasses may override this method.
		 * The default implementation returns the result of calling {@link orion.serviceregistry.ServiceRegistry#getService}
		 * passing the service reference.
		 * @name orion.ServiceTracker#addingService
		 * @function
		 * @param {orion.serviceregistry.ServiceReference} serviceRef The reference to the service being added.
		 * @returns {Object} The service object to be tracked for the given service reference. If <code>null</code> 
		 * is returned, the service reference will not be tracked.
		 */
		addingService: function(serviceRef) {
			return this.serviceRegistry.getService(serviceRef);
		},
		/**
		 * Called when this ServiceTracker has been opened. Subclasses can override this method.
		 * @name orion.ServiceTracker#onOpen
		 * @function
		 */
		onOpen: null,
		/**
		 * Called when this ServiceTracker has been closed. Subclasses can override this method.
		 * @name orion.ServiceTracker#onClose
		 * @function
		 */
		onClose: null,
		/**
		 * Called when a service is being added to this ServiceTracker. Subclasses can override this method to take part
		 * in the service's <code>'serviceAdded'</code> phase.
		 * @name orion.ServiceTracker#onServiceAdded
		 * @function
		 * @param {orion.serviceregistry.ServiceReference} serviceRef
		 * @param {orion.serviceregistry.Service} service
		 * @returns {Deferred|undefined} This method can optionally return a deferred. If it does, the returned deferred
		 * will be added to the service's <code>serviceAdded</code> listener queue; in other words, the returned deferred
		 * must resolve before any calls to the service's methods can proceed.
		 */
		onServiceAdded: null,
		/**
		 * Called when a service has been removed from this ServiceTracker. Subclasses may override this method.
		 * The default implementation does nothing.
		 * @name orion.ServiceTracker#removedService
		 * @function
		 * @param {orion.serviceregistry.ServiceReference} serviceRef The reference to the removed service.
		 * @param {orion.serviceregistry.Service} service The service object for the removed service.
		 */
		removedService: function(serviceRef, service) {
		}
	};

	return ServiceTracker;
});