const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Detect platform
const isWindows = process.platform === 'win32';
const isLinux = process.platform === 'linux';

// Store active stream process
let streamProcess = null;

// Serve a simple HTML page (gives 200 code ONLY)
app.get('/', (req, res) => {
	res.send(`
		<h1>Camera Server</h1>
		<p>View the stream at <a href="/stream">/stream</a></p>
		<strong>HTTP CODE: 200 OK</strong>
	`);
});

// Video stream endpoint
app.get('/stream', (req, res) => {
	// Set headers for MJPEG stream
	res.writeHead(200, {
		'Content-Type': 'multipart/x-mixed-replace; boundary=--boundary',
		'Cache-Control': 'no-cache, no-store, must-revalidate',
		'Pragma': 'no-cache',
		'Expires': '0',
		'Connection': 'keep-alive'
	});

	let ffmpegArgs;
	

	// Set the video size and frame rate to whatever you need or whatever your camera supports.
	// These might not work for your camera, so check your camera specs before running this, or errors will ensue!
	if (isWindows) {
		// Windows: Use DirectShow
		ffmpegArgs = [
		'-f', 'dshow',
		'-i', 'video=HD Pro Webcam C920', // find using ffmpeg -list_devices true -
		'-f', 'mjpeg',
		'-q:v', '5',
		'-r', '60',  // 60fps
		'-s', '1280x720',
		'-'
		];
	} else if (isLinux) {
		// Linux: Use Video4Linux2
		// Usually /dev/video0 is the default camera
		ffmpegArgs = [
		'-f', 'v4l2',
		'-i', '/dev/video0', 
		'-f', 'mjpeg',
		'-q:v', '5',
		'-r', '60',  // 60fps
		'-s', '1280x720',
		'-'
		];
	} else {
		res.status(500).send('Unsupported platform');
		return;
	}

	// Spawn FFmpeg process
	streamProcess = spawn('C:\\ffmpeg\\bin\\ffmpeg.exe', ffmpegArgs);

	let boundaryWritten = false;

	streamProcess.stdout.on('data', (chunk) => {
		// Write MJPEG boundary and content
		if (!boundaryWritten || chunk[0] === 0xFF && chunk[1] === 0xD8) {
		res.write('--boundary\r\n');
		res.write('Content-Type: image/jpeg\r\n');
		res.write('Content-Length: ' + chunk.length + '\r\n\r\n');
		boundaryWritten = true;
		}
		res.write(chunk);
		res.write('\r\n');
	});

	streamProcess.stderr.on('data', (data) => {
		console.error(`FFmpeg stderr: ${data}`);
	});

	streamProcess.on('close', (code) => {
		console.log(`FFmpeg process exited with code ${code}`);
		streamProcess = null;
	});

	// Clean up when client disconnects
	req.on('close', () => {
		if (streamProcess) {
		streamProcess.kill('SIGTERM');
		streamProcess = null;
		}
	});
});

// Stop stream endpoint
app.get('/stop', (req, res) => {
	if (streamProcess) {
		streamProcess.kill('SIGTERM');
		streamProcess = null;
		res.send('Stream stopped');
	} else {
		res.send('No active stream');
	}
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Platform: ${process.platform}`);
    console.log(`Video stream available at: http://localhost:${PORT}/stream`);
    console.log('\nNote: You may need to adjust the camera device name/path in the code');
    if (isWindows) {
      	console.log('Windows: Run "ffmpeg -list_devices true -f dshow -i dummy" to list cameras');
    } else if (isLinux) {
      	console.log('Linux: Check /dev/video* for available camera devices');
    }

});
