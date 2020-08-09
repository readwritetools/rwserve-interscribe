//=============================================================================
//
// File:         rwserve-interscribe/src/document-list.js
// Language:     ECMAScript 2015
// Copyright:    Read Write Tools © 2020
// License:      MIT License
// Initial date: Aug 3, 2020
// Contents:     An array of documentRefs
//
//=============================================================================

var log = require('rwserve-plugin-sdk').log;
var expect = require('rwserve-plugin-sdk').expect;
var SC = require('rwserve-plugin-sdk').SC;
var Pfile = require('joezone').Pfile;
var TextReader = require('joezone').TextReader;
var path = require('path');
var fs = require('fs');
var DocumentRef = require('./document-ref.class.js');

module.exports = class DocumentList {

	constructor(hostname, snrfilterFile) {
		expect(hostname, 'String');
		expect(snrfilterFile, 'String');
		
		this.hostname = hostname;
		this.snrfilterFile = new Pfile(snrfilterFile);
		this.snrfilterIndex = new Pfile(this.snrfilterFile.getPath()).addPath('snrfilter-index');

		this.countTotal = 0;				// number of document refs in snrfilterFile
		this.countKeep = 0;					// number of document refs kept
		this.documentList = new Array();
		this.currentDocumentRef = null;		// used when reading the snrfilter file
		this.nextIndex = -1;				// used when cycling through the list
		
    	Object.seal(this);
	}
	
	incrementIndex() {
		this.nextIndex++;
		if (this.nextIndex >= this.documentList.length)
			this.nextIndex = 0;
		return this.nextIndex;
	}

    // Create a new document ref, and make it "current"
    createDocumentRef() {
		this.currentDocumentRef = new DocumentRef();
		this.documentList.push(this.currentDocumentRef);
    }
    
    // Add it to the list if the host is not this
    keepDocumentInList() {
		this.documentList.push(this.currentDocumentRef);
    }
    
    //> snrfilterIndex is a file containing a single numeric value
    restoreRestartIndex() {
    	try {
    		if (this.snrfilterIndex.exists()) {
	    		var num = fs.readFileSync(this.snrfilterIndex.name, 'utf8');
	    		this.nextIndex = parseInt(num);
	    	}
	    	else
	    		this.nextIndex = -1;
			log.config(`RwserveInterscribe ${this.hostname} restarting at index ${this.nextIndex}`);
		}
		catch(err) {
			log.caught(err);
		}
    }
    
    saveRestartIndex() {
    	try {
    		fs.writeFileSync(this.snrfilterIndex.name, `${this.nextIndex}`, 'utf8');
			log.config(`RwserveInterscribe ${this.hostname} stopping at index ${this.nextIndex}`);
    	}
    	catch(err) {
    		log.caught(err);
    	}
    }
    
    // Read the snrfilterFile created by SNRFILTER
    readSnrfilter() {
    	if (!this.snrfilterFile.exists()) {
    		log.debug('RwserveInterscribe', `snrfilter file ${this.snrfilterFile.name} not found`);
    		return;
    	}

		var tr = new TextReader();
    	tr.open(this.snrfilterFile.name);
    	if (!tr.isOpen())
    		return;
    		
    	var line;
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
	    				this.countTotal++;
	    				break;
	    				
	    			case '!host':
	    				this.currentDocumentRef.host = value;
	    				// only keep references to external hosts
	    				if (this.currentDocumentRef.host != this.hostname) {
	    					this.keepDocumentInList();
		    				this.countKeep++;
	    				}
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
		log.config(`RwserveInterscribe ${this.hostname} ${this.countTotal} total references`);
		log.config(`RwserveInterscribe ${this.hostname} ${this.countKeep} references kept`);
    	return;
    }
}
