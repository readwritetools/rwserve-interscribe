










<figure>
	<img src='/img/plugins/interscribe/cedalion-on-the-shoulder-of-orion.jpg' width='100%' />
	<figcaption>Cedalion on the shoulder of Orion, ca. 1410, (artist unknown) </figcaption>
</figure>

# Interscribe

## RWSERVE plugin - Shoulders of giants


<address>
<img src='/img/rwtools.png' width=80 /> by <a href='https://readwritetools.com' title='Read Write Tools'>Read Write Tools</a> <time datetime=2020-08-08>Aug 8, 2020</time></address>



<table>
	<tr><th>Abstract</th></tr>
	<tr><td>This plugin is used in tandem with the <code>rwt-newton</code> web component to <i>interscribe</i> text references into an existing web page using just-in-time server processing.</td></tr>
</table>

### Motivation

This plugin reads a list of references generated via the `snrfilter` tool. Each
time the plugin is invoked a reference is pulled from the snrfilter document
list and inserted into the working document at a designated target point.

A cached copy of the interscribed merge is kept in the *interscribe-cache* for a
specified period of time and used for subsequent HTTP requests.

This plugin may be used with <span>BLUE</span><span>PHRASE</span> documents or
HTML documents.

#### Customization

This plugin is open source and can be used as is, or enhanced to provide
additional features.

The plugin may be used together with Etags, cache-control, and content-encoding
(compression).

### Download

The plugin module is available from <a href='https://www.npmjs.com/package/rwserve-interscribe'>NPM</a>
. Before proceeding, you should already have `Node.js` and `RWSERVE` configured and
tested.

This module should be installed on your web server in a well-defined place, so
that it can be discovered by `RWSERVE`. The standard place for public domain
plugins is `/srv/rwserve-plugins`.

<pre>
cd /srv/rwserve-plugins
npm install rwserve-interscribe
</pre>

### Configuration is Everything

Make the software available by declaring it in the `plugins` section of your
configuration file. For detailed instructions on how to do this, refer to the <a href='https://rwserve.readwritetools.com/plugins.blue'>plugins</a>
documentation on the `Read Write Tools HTTP/2 Server` website.

#### TL;DR

<pre>
plugins {
    rwserve-interscribe {
        location `/srv/rwserve-plugins/node_modules/rwserve-interscribe/dist/index.js`
        config {
            interscribe-cache   /srv/example.com/interscribe-cache
            cache-duration      86400
            snrfilter-file      /srv/example.com/etc/snrfilter
            snr-score-min       4
            insertion-target    < div id=interscribe-target>
            keep-target         before
            background          #777
        }
    }
    router {
        `*.blue`  *methods=GET,HEAD  *plugin=rwserve-blue 
        `*.blue`  *methods=GET,HEAD  *plugin=rwserve-interscribe
        `*.html`  *methods=GET,HEAD  *plugin=rwserve-interscribe
    }    
}
</pre>


<dl>
	<dt><code>interscribe-cache</code></dt>
	<dd>An absolute path to the directory to be used for caching the merged results. Typically this will be adjacent to the host's <code>public</code>, <code>dynamic-cache</code> and <code>encoding-cache</code> directories.</dd>
	<dt><code>cache-duration</code></dt>
	<dd>The time, in seconds, that the merged document should be kept in the cache before being recreated.</dd>
	<dt><code>snrfilter-file</code></dt>
	<dd>The absolute path to the file containing the references.</dd>
	<dt><code>snr-score-min</code></dt>
	<dd>The minimum <code>snrScore</code> that must be met for a doument ref to be used. This is an integer value. Document references in the <code>snrfilter-file</code> will be discarded if their <code>!snrScore</code> is less than this.</dd>
	<dt><code>insertion-target</code></dt>
	<dd>The HTML text that is searched for, within the current document, and used as the target point. This text should be unique within the document. If it isn't, the first occurrence will be used.</dd>
	<dt><code>keep-target</code></dt>
	<dd>
		<ul><code>before</code> - Keep the target text within the merged document and place it immediately <i>before</i> the interscribed text.</ul>
		<ul><code>after</code> - Keep the target text within the merged document and place it immediately <i>after</i> the interscribed text.</ul>
		<ul><code>discard</code> - Discard the target text.</ul>
	</dd>
	<dt><code>background</code></dt>
	<dd>The background color to use with the interscribed text. Any HTML color format may be used, like: <code>gray, #777, rgb(127,127,127)</code>.</dd>
</dl>

The sample `router` shown above will route any `GET` or `HEAD` request for <span>
BLUE</span><span>PHRASE</span> and HTML document to the ```/interscribe``` plugin for
processing.

#### Cookbook

A full configuration file with typical settings for a server running on
localhost port 7443, is included in this NPM module at `etc/interscribe-config`.
To use this configuration file, adjust these variables if they don't match your
server setup:

<pre>
$PLUGIN-PATH='/srv/rwserve-plugins/node_modules/rwserve-interscribe/dist/index.js'
$PRIVATE-KEY='/etc/pki/tls/private/localhost.key'
$CERTIFICATE='/etc/pki/tls/certs/localhost.crt'
$DOCUMENTS-PATH='/srv/rwserve/configuration-docs'
</pre>

### Review


<table>
	<tr><th>Lessons</th></tr>
	<tr><td>This plugin demonstrates a basic pattern that many plugins follow: <ul><li>Using default values provided in the configuration file.</li> <li>Using the work order's <code>proxyCache</code> and <code>proxyPath</code>.</li>  <li>Allowing plugins to make full use of the server's Etag, cache-control, and content-encoding services.</li> </ul> Find other plugins for the <code>Read Write Tools HTTP/2 Server</code> using <a href='https://www.npmjs.com/search?q=keywords:rwserve'>npm</a> with these keywords: <kbd>rwserve</kbd>, <kbd>http2</kbd>, <kbd>plugins</kbd>. </td></tr>
</table>

### License

The <span>rwserve-interscribe</span> plugin is licensed under the
MIT License.

<img src='/img/blue-seal-mit.png' width=80 align=right />

<details>
	<summary>MIT License</summary>
	<p>Copyright © 2020 Read Write Tools.</p>
	<p>Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:</p>
	<p>The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.</p>
	<p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
</details>

### Availability


<table>
	<tr><td>Source code</td> 			<td><a href='https://github.com/readwritetools/rwserve-interscribe'>github</a></td></tr>
	<tr><td>Package installation</td> <td><a href='https://www.npmjs.com/package/rwserve-interscribe'>NPM</a></td></tr>
	<tr><td>Documentation</td> 		<td><a href='https://hub.readwritetools.com/plugins/interscribe.blue'>Read Write Hub</a></td></tr>
</table>

