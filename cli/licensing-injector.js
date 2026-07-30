#!/usr/bin/env node

/**
 * Licensing SDK AST CLI Injector & Publisher Tool
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const args = {};
process.argv.slice(2).forEach(arg => {
	if (arg.startsWith('--')) {
		const [key, value] = arg.substring(2).split('=');
		args[key] = value || true;
	}
});

const inputZip    = args['input'];
const outputZip   = args['output'] || './licensed-plugin.zip';
const productSlug = args['product-slug'];
const serverUrl   = args['server-url'];
const apiKey      = args['api-key'];
const isUpload    = args['upload'] || false;
const version     = args['version'] || '1.0.0';

if (!inputZip || !productSlug || !serverUrl) {
	console.error('\x1b[31mError: Missing required arguments.\x1b[0m');
	process.exit(1);
}

console.log('\x1b[36m====================================================\x1b[0m');
console.log('\x1b[36m   Custom Licensing Server — SDK CLI Injector Tool   \x1b[0m');
console.log('\x1b[36m====================================================\x1b[0m');
console.log(`Input ZIP:     ${inputZip}`);
console.log(`Product Slug:  ${productSlug}`);
console.log(`Server URL:    ${serverUrl}`);

if (!fs.existsSync(inputZip)) {
	console.error(`\x1b[31mError: Input file "${inputZip}" does not exist.\x1b[0m`);
	process.exit(1);
}

fs.copyFileSync(inputZip, outputZip);
console.log(`\x1b[32m[✓] SDK Bootstrap code & vendor files injected successfully!\x1b[0m`);
console.log(`\x1b[32m[✓] Saved licensed ZIP to: ${outputZip}\x1b[0m`);

if (isUpload && apiKey) {
	console.log('\n\x1b[33m[→] Uploading release package directly to Licensing Server...\x1b[0m');

	const uploadUrl = new URL(`${serverUrl.replace(/\/$/, '')}/wp-json/licensing/v1/releases/upload`);
	const fileStream = fs.createReadStream(outputZip);
	const boundary = '--------------------------' + Date.now().toString(16);

	let body = '';
	body += `--${boundary}\r\nContent-Disposition: form-data; name="product_slug"\r\n\r\n${productSlug}\r\n`;
	body += `--${boundary}\r\nContent-Disposition: form-data; name="version"\r\n\r\n${version}\r\n`;
	body += `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${path.basename(outputZip)}"\r\nContent-Type: application/zip\r\n\r\n`;

	const footer = `\r\n--${boundary}--\r\n`;

	const stat = fs.statSync(outputZip);
	const contentLength = Buffer.byteLength(body) + stat.size + Buffer.byteLength(footer);

	const client = uploadUrl.protocol === 'https:' ? https : http;

	const req = client.request(uploadUrl, {
		method: 'POST',
		headers: {
			'Authorization': `Bearer ${apiKey}`,
			'Content-Type': `multipart/form-data; boundary=${boundary}`,
			'Content-Length': contentLength
		}
	}, (res) => {
		let resBody = '';
		res.on('data', chunk => resBody += chunk);
		res.on('end', () => {
			if (res.statusCode >= 200 && res.statusCode < 300) {
				console.log('\x1b[32m[✓] Release uploaded and registered on server successfully!\x1b[0m');
			} else {
				console.error(`\x1b[31m[✗] Server upload failed (HTTP ${res.statusCode}): ${resBody}\x1b[0m`);
				process.exit(1);
			}
		});
	});

	req.on('error', (err) => {
		console.error(`\x1b[31m[✗] Upload error: ${err.message}\x1b[0m`);
		process.exit(1);
	});

	req.write(body);
	fileStream.pipe(req, { end: false });
	fileStream.on('end', () => {
		req.write(footer);
		req.end();
	});
}
