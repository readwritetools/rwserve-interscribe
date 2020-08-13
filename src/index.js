//=============================================================================
//
// File:         rwserve-interscribe/src/index.js
// Language:     ECMAScript 2015
// Copyright:    Read Write Tools © 2020
// License:      MIT License
// Initial date: Aug 3, 2020
//
// Contents:     RWSERVE plugin to interscribe text into an existing file
//
//======================== Sample configuration ===============================
/*
	plugins {
		rwserve-interscribe {
			location `/srv/rwserve-plugins/node_modules/rwserve-interscribe/dist/index.js`
			config {
				interscribe-cache   `/srv/example.com/interscribe-cache`
				cache-duration      86400						// 1 day = 86400 = 24 * 60 * 60 (in seconds)
				snrfilter-file      `/srv/rwserve-plugins/node_modules/rwserve-interscribe/etc/data/snrfilter`
				snrfilter-restart   `/srv/rwserve-plugins/node_modules/rwserve-interscribe/etc/data/snrfilter-restart`
				snr-grades			A,B,C,D						// one or more grades to accept
				insertion-target    <div id=interscribe-target>
				keep-target			before						// before | after | discard
				background			#777
			}
		}
		router {
			`*.blue`  *methods=GET,HEAD  *plugin=rwserve-blue 
			`*.blue`  *methods=GET,HEAD  *plugin=rwserve-interscribe
			`*.html`  *methods=GET,HEAD  *plugin=rwserve-interscribe
		}	
	}
*/
//=============================================================================

import {log} 				from 'rwserve-plugin-sdk';
import {expect} 			from 'rwserve-plugin-sdk';
import {SC} 				from 'rwserve-plugin-sdk';
import {Pfile}				from 'joezone';
import {TextReader}			from 'joezone';
import path					from 'path';
import fs					from 'fs';
import DocumentList			from './document-list.class.js';
import DocumentRef			from './document-ref.class.js';


export default class RwserveInterscribe {

	constructor(hostConfig) {
		// config variables
		this.hostConfig       = hostConfig;
		this.hostname         = hostConfig.hostname;
		this.pluginConfig     = hostConfig.pluginsConfig.rwserveInterscribe;
		this.pluginVersion    = this.pluginConfig.pluginVersion;		
		this.snrGrades        = (this.pluginConfig.snrGrades == undefined) ? ['A', 'B', 'C', 'D'] : this.pluginConfig.snrGrades.split(',');
		this.cacheDuration    = this.pluginConfig.cacheDuration;
		this.insertionTarget  = this.pluginConfig.insertionTarget;
		this.keepTarget       = this.pluginConfig.keepTarget;
		this.background       = this.pluginConfig.background;

		this.interscribeCache = (this.pluginConfig.interscribeCache) ? this.pluginConfig.interscribeCache.sourceref : '';
		if (this.interscribeCache == undefined || this.interscribeCache == '')
			log.config(`RwserveInterscribe interscribe-cache must be enclosed in grave-accents (configuration: 'plugins/rwserve-interscribe/config/interscribe-cache')`);

		this.snrfilterFile = (this.pluginConfig.snrfilterFile) ? this.pluginConfig.snrfilterFile.sourceref : '';
		if (this.snrfilterFile == undefined || this.snrfilterFile == '')
			log.config(`RwserveInterscribe snrfilter-file must be enclosed in grave-accents (configuration: 'plugins/rwserve-interscribe/config/snrfilter-file')`);

		this.snrfilterRestart = (this.pluginConfig.snrfilterRestart) ? this.pluginConfig.snrfilterRestart.sourceref : '';
		if (this.snrfilterRestart == undefined || this.snrfilterRestart == '')
			log.config(`RwserveInterscribe snrfilter-restart must be enclosed in grave-accents (configuration: 'plugins/rwserve-interscribe/config/snrfilter-restart')`);
		
		// plugin variables
		this.documentList = new DocumentList(this);
		
    	Object.seal(this);
	}
	
	async startup() {
		log.config(`RwserveInterscribe version ${this.pluginVersion}; © 2020 Read Write Tools; MIT License`); 
		
		this.verifyInterscribeCache();
		this.verifyFilterRestart();
		
		try {
			this.documentList.readSnrfilter();
			this.documentList.restoreRestartIndex();
		}
		catch (err) {
			log.caught(err);
		}
	}
	
	async shutdown() {
		log.debug('RwserveInterscribe', `Shutting down ${this.hostname}`); 
		
		// Save the current document list index for the next restart 
		this.documentList.saveRestartIndex();
	}
	
	verifyInterscribeCache() {		
		if (this.interscribeCache === undefined || this.interscribeCache == '') {
			log.config(`RwserveInterscribe missing 'interscribe-cache' definition`);
			return;
		}		
		var pfile = new Pfile(this.interscribeCache);
		if (!pfile.exists()) {
			log.config(`RwserveInterscribe 'interscribe-cache' does not exist '${this.interscribeCache}'`);
			return;
		}		
		if (!pfile.isReadable()) {
			log.config(`RwserveInterscribe interscribe-cache read permission denied '${this.interscribeCache}' (configuration: 'plugins/rwserve-interscribe/config/interscribe-cache')`);
			return;
		}
		if (!pfile.isWritable()) {
			log.config(`RwserveInterscribe interscribe-cache write permission denied '${this.interscribeCache}' (configuration: 'plugins/rwserve-interscribe/config/interscribe-cache')`);
			return;
		}
	}
	
	verifyFilterRestart() {
		if (this.snrfilterRestart === undefined || this.snrfilterRestart == '') {
			log.config(`RwserveInterscribe missing 'snrfilter-restart' definition`);
			return;
		}		
		var pfile = new Pfile(this.snrfilterRestart);
		if (!pfile.exists()) {
			log.config(`RwserveInterscribe 'snrfilter-restart' does not exist '${this.snrfilterRestart}'`);
			return;
		}		
		if (!pfile.isReadable()) {
			log.config(`RwserveInterscribe snrfilter-restart read permission denied '${this.snrfilterRestart}' (configuration: 'plugins/rwserve-interscribe/config/snrfilter-restart')`);
			return;
		}
		if (!pfile.isWritable()) {
			log.config(`RwserveInterscribe snrfilter-restart write permission denied '${this.snrfilterRestart}' (configuration: 'plugins/rwserve-interscribe/config/snrfilter-restart')`);
			return;
		}
	}

	
	async processingSequence(workOrder) {		
		// Immediately upon arrival here check for problems discovered in the requestHandler
		if (workOrder.doNotFulfill == true)
	    	return;
		
		var requestMethod = workOrder.getMethod();
		if (['OPTIONS','TRACE'].includes(requestMethod)) {
			return;
		}
		if (!['GET','HEAD'].includes(requestMethod)) {
			workOrder.addStdHeader('allow', 'GET,HEAD,OPTIONS,TRACE');
			workOrder.setStatusCode(SC.METHOD_NOT_ALLOWED_405);
			workOrder.setEmptyResponseBody();
			return;
		}
		
		try {		
			var publicPfile = this.determinePublicPath(workOrder);
			var dynamicPfile = this.determineDynamicPath(workOrder);
			var interscribePfile = this.determineInterscribePath(workOrder);
			var sourceFileExtension = publicPfile.getExtension();

			// if the public file does not exist, return immediately and allow standard processing to occur
			if (!publicPfile.exists()) {
				workOrder.addXHeader('rw-public-file-not-found', null, null, SC.NOT_FOUND_404);
				workOrder.setEmptyResponseBody();
				return;
			}
			
			// if the public file is BLUE, make sure the dynamic cache already has its HTML counterpart
			if (sourceFileExtension == 'blue') {
				if (!dynamicPfile.exists()) {
					workOrder.addXHeader('rw-dynamic-cache-not-found', null, null, SC.NOT_FOUND_404);
					workOrder.setEmptyResponseBody();
					return;
				}			
			}
			
			// if this is the first time it's been requested, then it must be processed
			if (!interscribePfile.exists()) {
				var bCreated = false;
				if (sourceFileExtension == 'blue')
					bCreated = this.interscribeProcess(dynamicPfile, interscribePfile);
				else //  (sourceFileExtension == 'html')
					bCreated = this.interscribeProcess(publicPfile, interscribePfile);
				
				if (bCreated)
					workOrder.addXHeader('rw-interscribe-cache-created');
				else
					return;
			}

			// not the first time, check to see if it's expired
			else {
				var milliseconds = parseInt(this.cacheDuration) * 1000;				// convert cacheDuration, in seconds, to milliseconds 
				var now = new Date();
				var cacheExpiration = now.valueOf() - milliseconds;					// a number, in milliseconds
				
				// if the interscribe-cache file has expired, recreate it
				if (interscribePfile.getModificationTime().valueOf() < cacheExpiration ) {
					var bCreated = false;
					if (sourceFileExtension == 'blue')
						bCreated = this.interscribeProcess(dynamicPfile, interscribePfile);
					else //  (sourceFileExtension == 'html')
						bCreated = this.interscribeProcess(publicPfile, interscribePfile);
					
					if (bCreated)
						workOrder.addXHeader('rw-interscribe-cache-recreated');
					else
						return;
				}
				else {
					workOrder.addXHeader('rw-interscribe-cache-used');
				}
			}
			
			// sanity
			if (!interscribePfile.exists()) {
				workOrder.addXHeader('rw-interscribe-cache-not-found', null, null, SC.NOT_FOUND_404);
				workOrder.setEmptyResponseBody();
			}
			else {
				workOrder.setProxyLocation(this.determineProxyCache(), this.determineProxyPath(workOrder));
				workOrder.pushCandidate = true;
				// allow standard response processing to perform etag, content-encoding, content-length, status-code
			}
		}		
		catch (err) {
			log.caught(err);
			workOrder.setEmptyResponseBody();
			workOrder.setStatusCode(SC.INTERNAL_SERVER_ERROR_500);
		}
	}	
	
	
	//^ Build the FQN of the public resource
	//< Pfile of the original HTML or BLUE file
	determinePublicPath(workOrder) {
		expect(workOrder, 'WorkOrder');

		var resourcePath = workOrder.getResourcePath();										//  (String) /path/to/sample.blue
		var publicPfile = new Pfile(this.hostConfig.documentRoot).addPath(resourcePath);	//  (Pfile)  /example.com/public/path/to/sample.blue
		return publicPfile;
	}
	
	//^ Build the FQN for the dynamic-cache resource
	//< Pfile of the dynamic-cache file. It will always be an HTML file
	determineDynamicPath(workOrder) {
		expect(workOrder, 'WorkOrder');

		var resourcePath = workOrder.getResourcePath();										//  (String) /path/to/sample.blue
		var dynamicPfile = new Pfile(this.hostConfig.dynamicCache).addPath(resourcePath);	//  (Pfile)  /example.com/dynamic-cache/path/to/sample.blue
		dynamicPfile.replaceExtension('html');												//  (Pfile)  /example.com/dynamic-cache/path/to/sample.html
		return dynamicPfile;
	}
	
	//^ Build the FQN for the interscribe-cache resource
	//< Pfile of the interscribe-cache file. It will always be an HTML file
	determineInterscribePath(workOrder) {
		expect(workOrder, 'WorkOrder');

		var resourcePath = workOrder.getResourcePath();										//  (String) /path/to/sample.blue
		var interscribePfile = new Pfile(this.interscribeCache);							//  (Pfile)  /example.com/interscribe-cache
		interscribePfile.addPath(resourcePath);												//  (Pfile)  /example.com/interscribe-cache/path/to/sample.blue
		interscribePfile.replaceExtension('html');											//  (Pfile)  /example.com/interscribe-cache/path/to/sample.html
		return interscribePfile;
	}

	//^ determine the proxyCache
	determineProxyCache() {
		return this.interscribeCache;
	}
	
	//^ determine the proxyPath
	determineProxyPath(workOrder) {
		expect(workOrder, 'WorkOrder');
		
		var resourcePath = workOrder.getResourcePath();										//  (String) /path/to/sample.blue
		var pfile = new Pfile(resourcePath);												//  (Pfile)  /path/to/sample.blue
		pfile.replaceExtension('html');														//  (Pfile)  /path/to/sample.html
		return pfile.name;
	}
	
	// the work is done here
	//< true if the intersrcribed file was created
	//< false if the interscribed file was not created. Continue with the standard response processing sequence.
	interscribeProcess(sourcePfile, interscribePfile) {
		expect(sourcePfile, 'Pfile');
		expect(interscribePfile, 'Pfile');
		
		try {		
			// read the resource file and find the user-configured insertion area
			var resourceText = fs.readFileSync(sourcePfile.name, 'utf8');
			var insertAt = resourceText.indexOf(this.insertionTarget);
			if (insertAt == -1)
				return false;
			
			// insert text into resourceText completely replacing the insertionTarget text 
			var index = this.documentList.incrementIndex();
			var documentRef = this.documentList.documentList[index];
			var insertionText = documentRef.assembleInsertionText(this.background);
			var before = (this.keepTarget == 'before') ? this.insertionTarget : '';
			var after  = (this.keepTarget == 'after' ) ? this.insertionTarget : '';
			var payloadText = resourceText.substr(0, insertAt) 
							+ before
							+ insertionText
							+ after
							+ resourceText.substr(insertAt + this.insertionTarget.length);
			
			// save the patched contents to the interscribe cache
			fs.writeFileSync(interscribePfile.name, payloadText, 'utf8');
			return true;
		}
		catch (err) {
			log.caught(err);
			return false;
		}
	}
}
