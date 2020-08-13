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

	constructor(rwserveInterscribe) {
		expect(rwserveInterscribe, 'RwserveInterscribe');
		expect(rwserveInterscribe.hostname, 'String');
		expect(rwserveInterscribe.snrfilterFile, 'String');
    	expect(rwserveInterscribe.snrGrades, 'Array');
		
    	this.rwserveInterscribe = rwserveInterscribe;
		this.hostname = this.rwserveInterscribe.hostname;
		this.snrfilterFile = new Pfile(this.rwserveInterscribe.snrfilterFile);
		if (this.rwserveInterscribe.snrfilterRestart != '')
			this.snrfilterRestart = new Pfile(this.rwserveInterscribe.snrfilterRestart);
		else
			this.snrfilterRestart = new Pfile(this.snrfilterFile.getPath()).addPath('snrfilter-index');
		this.snrGrades = this.rwserveInterscribe.snrGrades;

		this.countTotal = 0;				// number of document refs in snrfilterFile
		this.countKeep = 0;					// number of document refs kept
		this.documentList = new Array();
		this.currentDocumentRef = null;		// used when reading the snrfilter file
		this.nextIndex = -1;					// used when cycling through the list
		
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
    }
    
    // Call this routine whenever !host or !snr:grade is parsed.
    // Push the document to the list only when both values have been parsed, and only if:
    //   the host is not this host
    //   the snrGrade is acceptable
    conditionalKeepDoc() {
    	// wait for both values to be parsed . . .
    	if (this.currentDocumentRef.host == '')
    		return;
    	if (this.currentDocumentRef.snrGrade == '')
    		return;
    	
    	// we only want to keep document refs to external hosts
		if (this.currentDocumentRef.host == this.hostname)
			return;

		// we only want to keep document refs if they have an SNR grade that's specified in the configured list
		if (!this.snrGrades.includes(this.currentDocumentRef.snrGrade))
			return;
		
	    this.documentList.push(this.currentDocumentRef);
		this.countKeep++;
    }
    
    //> snrfilterRestart is a file containing a single numeric value
    restoreRestartIndex() {
    	try {
    		if (this.snrfilterRestart.exists()) {
	    		var num = fs.readFileSync(this.snrfilterRestart.name, 'utf8');
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
    		fs.writeFileSync(this.snrfilterRestart.name, `${this.nextIndex}`, 'utf8');
			log.config(`RwserveInterscribe ${this.hostname} stopping at index ${this.nextIndex}`);
    	}
    	catch(err) {
    		log.caught(err);
    	}
    }
    
    // Read the snrfilterFile created by SNRFILTER
    readSnrfilter() {
    	if (!this.snrfilterFile.exists()) {
    		log.config(`RwserveInterscribe snrfilter file ${this.snrfilterFile.name} not found`);
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
    					this.conditionalKeepDoc();
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
	    				
	    			case '!snr:grade':
	    				this.currentDocumentRef.snrGrade = value;
    					this.conditionalKeepDoc();
	    				break;
	    				
	    			case '!keywords':
	    				this.currentDocumentRef.keywords = value;
	    				break;
	    				
	    			case '!topwords':
	    				this.currentDocumentRef.topwords = value;
	    				break;
    				
    				default:
    					log.error(`Unexpected meta data ${keyword}=${value} in ${snrfilterFile}`);
    			}
    		}
    	}
    	tr.close();
    	var discarded = this.countTotal - this.countKeep;
		log.config(`RwserveInterscribe ${this.hostname} ${this.countKeep} references kept, ${discarded} discarded`);
    	return;
    }
}
