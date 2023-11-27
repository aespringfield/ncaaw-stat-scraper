// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 4023;
const rootDir = path.join(__dirname, '..', 'fixtures/pages');
let server;

const start = (domain) => {
  server = http.createServer((req, res) => {
    const reqUrl = url.parse(req.url);

    const sanitizedPath = path.normalize(reqUrl.pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(rootDir, domain, sanitizedPath);

    // Determine the content type based on the file extension
    const ext = path.extname(filePath).toLowerCase();
    let contentType = 'text/plain';

    // Some wonky requests for this one
    if (domain === 'herhoopstats.com') {
      switch (ext) {
        case '.js':
          contentType = 'application/javascript';
          break;
        default:
          contentType = 'text/html';
          filePath = path.join(filePath, 'index.html');
          break;
      }
    }

    // Check if the file exists
    fs.exists(filePath, (exists) => {
      if (!exists) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      // Read and serve the file
      fs.readFile(filePath, { encoding: 'utf-8' }, (err, data) => {
        if (err) {
          console.error('Error reading file:', err);
          res.writeHead(500);
          res.end('Server Error');
          return;
        }

        // Check if data looks like it might be JSON
        if (data.trim().startsWith('{') && data.trim().endsWith('}')) {
          try {
            // Attempt to parse JSON
            const parsedData = JSON.parse(data.replace(/'/g, '"'));
            if (parsedData.Location) {
              res.writeHead(302, { 'Location': parsedData.Location });
              res.end();
              return;
            }
          } catch (parseError) {
            // Handle JSON parsing errors
            console.error('Error parsing JSON:', parseError);
          }
        }

        // If not JSON or JSON doesn't contain a redirect, serve the file content
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
      });
    });
  });

  return new Promise(resolve => {
    server.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}/`);
      resolve();
    });
  });
};

const stop = () => {
  return new Promise(resolve => {
    server.close(() => {
      console.log('Server stopped');
      resolve();
    });
  });
};

const uri = () => `http://localhost:${PORT}`;

const MockServer = { start, stop, uri };

module.exports = { MockServer };
