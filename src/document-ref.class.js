//=============================================================================
//
// File:         rwserve-interscribe/src/document-ref.class.js
// Language:     ECMAScript 2015
// Copyright:    Joe Honton © 2020
// License:      CC-BY-NC-ND 4.0
// Initial date: Aug 3, 2020
// Contents:     An instance of a document reference
//
//=============================================================================

import {expect}			from 'joezone';

export default class DocumentRef {
	
    constructor() {
		this.url = '';							// https://example.com/dir/subdir/filename
		this.host = '';							// https://example.com
		this.lastmod = '';						// YYYY-MM-DD
		this.title = '';
		this.description = '';
		this.rwtTitle = '';
		this.rwtKicker = '';
		this.bestwords = '';
		this.snrScore = null;
		Object.seal(this);
    }
	
	//< the HTML string to insert
	assembleInsertionText(background) {
		var rwtKicker = this.rwtKicker.replace("'", "");
		var h2Words = DocumentRef.wordsAsString(this.bestwords, 0, 2);	// [0], [1]
		var h3Words = DocumentRef.wordsAsString(this.bestwords, 2, 5);	// [2], [3], [4]
		var dtWords = DocumentRef.wordsAsString(this.bestwords, 5, 7);	// [5], [6]
		
		return `
		<script src='/node_modules/rwt-newton/rwt-newton.js' type=module></script>
		<rwt-newton role=navigation background='${background}'>
			<span slot=h2>${h2Words}</span>
			<span slot=h3>${h3Words}</span>
			<span slot=dt>${dtWords}</span>
			<span slot=dd><a href='${this.url}' title='${rwtKicker}'>${this.rwtTitle}</a> ${this.description}</span>
		</rwt-newton>
		`;
	}

	//^ 'one,two,three,four,five' --> 'One two three'
	//> keywords is a comma separated string
	//> first is the index of the first word to keep
	//> last is the index of the last word to keep
	//< returns a string
	static wordsAsString(keywords, first, last) {
		var arr = keywords.split(',');
		arr = arr.slice(first, last);
		var s = arr.join(' ');
		if (s.length == 0)
			return '';
		else
			return s.charAt(0).toUpperCase() + s.slice(1);
	}
}
