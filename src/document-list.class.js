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

import {log} 				from 'rwserve-plugin-sdk';
import {expect} 			from 'rwserve-plugin-sdk';
import {SC} 				from 'rwserve-plugin-sdk';
import {Pfile}				from 'joezone';
import {TextReader}			from 'joezone';
import path					from 'path';
import fs					from 'fs';
import DocumentRef			from './document-ref.class.js';

export default class DocumentList {

	constructor(rwserveInterscribe) {
		expect(rwserveInterscribe, 'RwserveInterscribe');
		expect(rwserveInterscribe.hostname, 'String');
		expect(rwserveInterscribe.snrfilterFile, 'String');
    	expect(rwserveInterscribe.snrScoreMin, 'Number');
		
    	this.rwserveInterscribe = rwserveInterscribe;
		this.hostname = this.rwserveInterscribe.hostname;
		this.snrfilterFile = new Pfile(this.rwserveInterscribe.snrfilterFile);
		if (this.rwserveInterscribe.snrfilterRestart != '')
			this.snrfilterRestart = new Pfile(this.rwserveInterscribe.snrfilterRestart);
		else
			this.snrfilterRestart = new Pfile(this.snrfilterFile.getPath()).addPath('snrfilter-restart');
		this.snrScoreMin = this.rwserveInterscribe.snrScoreMin;
		
		this.countTotal = 0;				// number of document refs in snrfilterFile
		this.countKeep = 0;					// number of document refs kept
		this.documentList = new Array();
		this.currentDocumentRef = null;		// used when reading the snrfilter file
		this.nextIndex = -1;				// used when cycling through the list
		
    	Object.seal(this);
	}
	
	//< on failure return -1
	//< on success return a valid index
	incrementIndex() {
		if (this.documentList.length == 0)
			return -1;
		if (Number.isNaN(this.nextIndex))
			return -1;
		
		this.nextIndex++;
		if (this.nextIndex < 0)							// just in case
			this.nextIndex = 0;
		if (this.nextIndex >= this.documentList.length) // rollover
			this.nextIndex = 0;
		return this.nextIndex;
	}

    // Create a new document ref, and make it "current"
    createDocumentRef() {
		this.currentDocumentRef = new DocumentRef();
    }
    
    // Call this routine whenever !host or !snrScore is parsed.
    // Push the document to the list only when both values have been parsed, and only if:
    //   the host is not this host
    //   the snrScore meets the minimum required value
    conditionalKeepDoc() {
    	// wait for both values to be parsed . . .
    	if (this.currentDocumentRef.host == '')
    		return;
    	if (this.currentDocumentRef.snrScore == null)
    		return;
    	
    	// we only want to keep document refs to external hosts
		if (this.currentDocumentRef.host == this.hostname)
			return;

		// we only want to keep document refs if they have an SNR score that meets the minimum
		if (this.currentDocumentRef.snrScore < this.snrScoreMin)
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
	    		if (Number.isNaN(this.nextIndex))
	    			this.nextIndex = -1;
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
	    				
	    			case '!bestwords':
	    				this.currentDocumentRef.bestwords = value;
	    				break;
    				
	    			case '!snrScore':
	    				this.currentDocumentRef.snrScore = parseInt(value);
    					this.conditionalKeepDoc();
	    				break;
    				
	    			case '!snr:grade':
	    			case '!keywords':
	    			case '!topwords':
	    			case '!neowords':
	    			case '!techwords':
	    			case '!seowords':
	    			case '!keywords':
	    			case '!keywords':
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
