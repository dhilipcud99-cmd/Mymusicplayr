const http = require('http');
const fs = require('fs');
const path = require('path');
const https = require('https');

const PORT = 5500;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getYoutubeVideoId(query) {
  return new Promise((resolve, reject) => {
    const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    https.get(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    }, (res) => {
      let html = '';
      res.on('data', chunk => { html += chunk; });
      res.on('end', () => {
        const videoIdRegex = /"videoId":"([a-zA-Z0-9_-]{11})"/;
        const match = html.match(videoIdRegex);
        if (match) {
          resolve(match[1]);
        } else {
          const fallbackRegex = /\/watch\?v=([a-zA-Z0-9_-]{11})/;
          const matchFallback = html.match(fallbackRegex);
          if (matchFallback) {
            resolve(matchFallback[1]);
          } else {
            resolve(null);
          }
        }
      });
    }).on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  
  // API YouTube Search Endpoint
  if (urlObj.pathname === '/api/youtube-search') {
    const q = urlObj.searchParams.get('q');
    if (!q) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: "Missing query parameter 'q'" }));
      return;
    }
    
    try {
      const videoId = await getYoutubeVideoId(q);
      res.writeHead(200, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      });
      res.end(JSON.stringify({ videoId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }
  
  // Serve static files
  let filePath = path.join(__dirname, 'www', urlObj.pathname === '/' ? 'index.html' : urlObj.pathname);
  const ext = path.extname(filePath);
  let contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
});
