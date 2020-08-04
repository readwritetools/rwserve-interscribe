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
				snrfilter-file      /palau/plugins.rwserve-interscribe/etc/blue-rwt-snrfilter
				insertion-area      <!-- RWSERVE-interscribe -->
				background			#777
			}
		}
		router {
			`/*.html`  *methods=GET,HEAD  *plugin=rwserve-interscribe
		}	
	}
*/
//=============================================================================

import {log} 				from 'rwserve-plugin-sdk';
import {expect} 			from 'rwserve-plugin-sdk';
import {SC} 				from 'rwserve-plugin-sdk';
import {Pfile}				from 'joezone';
import {TextReader}			from 'joezone';
import DocumentRef			from './document-ref.class.js';

export default class RwserveInterscribe {

	constructor(hostConfig) {
		
		// config variables
		this.hostname       = hostConfig.hostname;
		this.pluginVersion  = hostConfig.pluginsConfig.RwserveInterscribe.pluginVersion;		
		this.snrfilterFile  = hostConfig.pluginsConfig.RwserveInterscribe.snrfilterFile;
		this.insertionArea  = hostConfig.pluginsConfig.RwserveInterscribe.insertionArea;
		this.background     = hostConfig.pluginsConfig.RwserveInterscribe.background;
		
		// plugin variables
		this.documentList = new Array();
		this.currentDocumentRef = null;		// used when reading the snrfilter file
		this.nextIndex = -1;				// used when cycling through the list
		
    	Object.seal(this);
	}
	
	async startup() {
		log.debug('RwserveInterscribe', `version ${this.pluginVersion}; © 2020 Read Write Tools; MIT License`); 
		
		try {
			this.readSnrfilter(this.snrfilterFile);
		}
		catch (err) {
			log.caught(err);
		}
	}
	
	async shutdown() {
		log.debug('RwserveInterscribe', `Shutting down ${this.hostname}`); 
	}
	
	async processingSequence(workOrder) {
		
		// This plugin is only meaningful for GET and HEAD
		if (workOrder.getMethod() != 'GET' && workOrder.getMethod() != 'HEAD')
			return;
		
		try {		
			var resourcePath = workOrder.getResourcePath();
			var absoluteResourcePath = path.join(this.hostConfig.documentRoot, resourcePath);
			
			// if the file does not exist, return immediately and allow standard processing to occur
			if (fs.existsSync(absoluteResourcePath))
				return;

			// read the file and find the user-configured insertion area
			var resourceText = fs.readFileSync(absoluteResourcePath.name, 'utf8');
			var insertAt = resourceText.indexOf(this.insertionArea);
			if (insertAt == -1)
				return;
			
			// insert text into resourceText completely replacing the insertionArea text 
			var index = this.incrementIndex();
			var documentRef = this.documentList[index];
			var insertionText = documentRef.assembleInsertionText(this.background);
			var payloadText = resourceText.substr(0, insertAt) 
							+ insertionText
							+ resourceText.substr(insertAt + this.insertionArea.length + 1);
			
			workOrder.setResponseBody(payloadText);			
			workOrder.setStatusCode(SC.OK_200);		
		}
		catch (err) {
			log.caught(err);
		}
	}
	
	incrementIndex() {
		this.nextIndex++;
		if (this.nextIndex >= this.documentList.length)
			this.nextIndex = 0;
		return this.nextIndex;
	}
	

    // Create a new document ref, add it to the list, and make it "current"
    createDocumentRef() {
		this.currentDocumentRef = new DocumentRef();
		this.documentList.push(this.currentDocumentRef);
    }
    
    // Read the snrfilterFile created by SNRFILTER
    readSnrfilter(snrfilterFile) {
    	expect(wordFile, 'Pfile');
    	
    	var pfile = new Pfile(this.snrfilterFile);
    	if (!pfile.exists() {
    		log.debug('RwserveInterscribe', `snrfilter file ${this.snrfilterFile} not found`);
    		return;
    	}

		var tr = new TextReader();
    	tr.open(snrfilterFile);
    	if (!tr.isOpen())
    		return;
    		
    	while ((line = tr.getline()) != null) {
    		if (line.trim() == '') 						  	 		// skip blank lines
    			continue;

    		var firstSpace = line.indexOf(' ');
    		if (firstSpace != -1) {
        		var firstPart = line.substr(0, firstSpace);
        		var remainder = line.substr(firstSpace+1);
    		}
    		else {
        		var firstPart = line;								// probably !path without a value
        		var remainder = '';
    		}
    		
    		var isMetadata = (firstPart.charAt(0) == '!');
    		if (isMetadata) {
    			var keyword = firstPart;
    			var value = remainder;
    			switch (keyword) {
	    			case '!url':
	    				this.createDocumentRef();
	    				this.currentDocumentRef.url = value;
	    				break;
	    				
	    			case '!host':
	    				this.currentDocumentRef.host = value;
	    				break;
	    				
	    			case '!lastmod':
	    				this.currentDocumentRef.lastmod = value;
	    				break;
	    				
	    			case '!title':
	    				this.currentDocumentRef.title = value;
	    				break;
	    				    				
	    			case '!description':
	    				this.currentDocumentRef.description = value;
	    				break;
	    				
	    			case '!rwt:title':
	    				this.currentDocumentRef.rwtTitle = value;
	    				break;
	    				
	    			case '!rwt:kicker':
	    				this.currentDocumentRef.rwtKicker = value;
	    				break;
	    				
	    			case '!keywords':
	    				this.currentDocumentRef.keywords = value;
	    				break;
	    				
	    			case '!topwords':
	    				this.currentDocumentRef.topwords = value;
	    				break;
    				
    				default:
    					terminal.abnormal(`Unexpected meta data ${keyword}=${value} in ${snrfilterFile}`);
    			}
    		}
    	}
    	tr.close();
    	return;
    }
}
