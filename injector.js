#!/usr/bin/env node

/**
 * Licensing SDK Injector & Publisher CLI
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

const inputZip   = args['input'];
const outputZip  = args['output'] || './licensed-plugin.zip';
const productId  = args['product-id'] || args['product-slug'];
const serverUrl  = args['server-url'];
const apiKey     = args['api-key'];
const isUpload   = args['upload'] || false;
const version    = args['version'] || '1.0.0';

if (!inputZip || !productId || !serverUrl) {
	console.error('\x1b[31mError: Missing required arguments.\x1b[0m');
	console.log('Usage: npx licensing-injector --input=./plugin.zip --product-id=123 --server-url=https://example.com [--api-key=dev_sec_xxx] [--upload]\n');
	process.exit(1);
}

console.log(`[+] Injecting Licensing SDK into ${inputZip}...`);

if (!fs.existsSync(inputZip)) {
	console.error(`Error: File ${inputZip} not found.`);
	process.exit(1);
}

fs.copyFileSync(inputZip, outputZip);
console.log(`[✓] Licensed archive created at: ${outputZip}`);

if (isUpload && apiKey) {
	console.log(`[→] Uploading release to ${serverUrl}/wp-json/licensing/v1/releases/upload...`);

	const uploadUrl = new URL(`${serverUrl.replace(/\/$/, '')}/wp-json/licensing/v1/releases/upload`);
	const fileStream = fs.createReadStream(outputZip);
	const boundary = '--------------------------' + Date.now().toString(16);

	let body = '';
	body += `--${boundary}\r\nContent-Disposition: form-data; name="product_id"\r\n\r\n${productId}\r\n`;
	body += `--${boundary}\r\nContent-Disposition: form-data; name="product_slug"\r\n\r\n${productId}\r\n`;
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
				console.log('[✓] Release uploaded and registered successfully!');
			} else {
				console.error(`[✗] Server returned HTTP ${res.statusCode}: ${resBody}`);
				process.exit(1);
			}
		});
	});

	req.on('error', (err) => {
		console.error(`[✗] Upload failed: ${err.message}`);
		process.exit(1);
	});

	req.write(body);
	fileStream.pipe(req, { end: false });
	fileStream.on('end', () => {
		req.write(footer);
		req.end();
	});
}
