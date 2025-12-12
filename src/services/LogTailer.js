const fs = require('fs');
const path = require('path');
const chokidar = require('chokidar');
const { EventEmitter } = require('events');
const LogParser = require('./LogParser');
const LogIndexer = require('./LogIndexer');

class LogTailer extends EventEmitter {
  constructor(projectId, logFilePath) {
    super();
    this.projectId = projectId;
    this.logFilePath = logFilePath;
    this.watcher = null;
    this.filePosition = 0;
    this.currentEntry = null;
    this.isWatching = false;
  }

  /**
   * Start tailing the log file
   */
  async start() {
    if (this.isWatching) {
      return;
    }

    // Read existing file to get initial position
    if (fs.existsSync(this.logFilePath)) {
      const stats = fs.statSync(this.logFilePath);
      this.filePosition = stats.size;
      
      // Optionally read last N lines for context
      await this.readRecentLines(100);
    }

    // Watch for file changes
    this.watcher = chokidar.watch(this.logFilePath, {
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', () => this.handleFileChange());
    this.watcher.on('error', (error) => this.emit('error', error));

    this.isWatching = true;
    this.emit('started');
  }

  /**
   * Stop tailing
   */
  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    this.isWatching = false;
    this.emit('stopped');
  }

  /**
   * Handle file change event
   */
  async handleFileChange() {
    try {
      const stats = fs.statSync(this.logFilePath);
      
      // Check if file was truncated
      if (stats.size < this.filePosition) {
        this.filePosition = 0;
        this.currentEntry = null;
      }

      // Read new content
      const stream = fs.createReadStream(this.logFilePath, {
        start: this.filePosition,
        encoding: 'utf8'
      });

      let buffer = '';

      stream.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop();

        // Process complete lines
        lines.forEach(line => this.processLine(line));
      });

      stream.on('end', () => {
        this.filePosition = stats.size;
      });

      stream.on('error', (error) => {
        this.emit('error', error);
      });
    } catch (error) {
      this.emit('error', error);
    }
  }

  /**
   * Process a single log line
   */
  processLine(line) {
    if (!line.trim()) return;

    const parsed = LogParser.parseLine(line, this.currentEntry);

    if (parsed) {
      if (parsed.isNew) {
        // Finalize previous entry if exists
        if (this.currentEntry) {
          const finalized = LogParser.finalizeEntry(this.currentEntry);
          this.emitEntry(finalized);
        }

        // Start new entry
        this.currentEntry = parsed.entry;
      } else {
        this.currentEntry = parsed.entry;
      }
    }
  }

  /**
   * Emit a complete log entry
   */
  emitEntry(entry) {
    // Emit to listeners
    this.emit('entry', entry);

    // Index if it's an error
    if (entry.level === 'ERROR' || entry.level === 'CRITICAL' || entry.level === 'EMERGENCY') {
      try {
        const result = LogIndexer.indexError(this.projectId, entry);
        this.emit('error-indexed', result);
      } catch (error) {
        this.emit('error', error);
      }
    }
  }

  /**
   * Read recent lines from file for initial context
   */
  async readRecentLines(lineCount) {
    try {
      const stats = fs.statSync(this.logFilePath);
      const bufferSize = 50 * 1024; // Read last 50KB
      const start = Math.max(0, stats.size - bufferSize);
      
      const stream = fs.createReadStream(this.logFilePath, {
        start: start,
        encoding: 'utf8'
      });

      let buffer = '';
      const lines = [];

      for await (const chunk of stream) {
        buffer += chunk;
      }

      // If we didn't start at 0, potentially discard partial first line
      if (start > 0) {
        const firstNewline = buffer.indexOf('\n');
        if (firstNewline !== -1) {
          buffer = buffer.substring(firstNewline + 1);
        }
      }

      lines.push(...buffer.split('\n'));
      
      // Take last N lines
      const recentLines = lines.slice(-lineCount);
      
      // Parse them
      const entries = LogParser.parse(recentLines.join('\n'));
      
      // Emit each entry
      entries.forEach(entry => this.emit('entry', entry));
      
      return entries;
    } catch (error) {
      console.error('Error reading recent lines:', error);
      return [];
    }
  }

  /**
   * Index entire log file
   */
  async indexEntireFile() {
    return new Promise((resolve, reject) => {
      const stream = fs.createReadStream(this.logFilePath, { encoding: 'utf8' });
      const rl = require('readline').createInterface({
        input: stream,
        crlfDelay: Infinity
      });

      let currentEntry = null;
      let entries = [];
      const BATCH_SIZE = 500;
      
      const totalStats = {
        total: 0,
        new: 0,
        updated: 0
      };

      const processBatch = async () => {
        if (entries.length === 0) return;
        
        try {
          const stats = LogIndexer.index(this.projectId, entries);
          totalStats.total += stats.total;
          totalStats.new += stats.new;
          totalStats.updated += stats.updated;
          
          // Clear processed entries
          entries = [];
          
          // Yield to event loop to prevent blocking
          await new Promise(resolve => setImmediate(resolve));
        } catch (err) {
          console.error('Error indexing batch:', err);
          // Continue despite error? Or reject?
          // For now, log and continue to try processing rest of file
        }
      };

      rl.on('line', (line) => {
        const parsed = LogParser.parseLine(line, currentEntry);
        if (parsed) {
          if (parsed.isNew) {
            if (currentEntry) {
              const finalized = LogParser.finalizeEntry(currentEntry);
              entries.push(finalized);
              
              // Process batch if full
              if (entries.length >= BATCH_SIZE) {
                  // We need to pause the stream or handle async inside sync 'line' event.
                  // Readline doesn't support async/await in 'line' handler nicely (it won't pause).
                  // However, since we are just accumulating, we can try to run index synchronously? 
                  // No, that freezes UI.
                  // BETTER: Pause stream, process, resume.
                  stream.pause();
                  processBatch().then(() => stream.resume());
              }
            }
            currentEntry = parsed.entry;
          } else {
            currentEntry = parsed.entry;
          }
        }
      });

      rl.on('close', async () => {
        if (currentEntry) {
          entries.push(LogParser.finalizeEntry(currentEntry));
        }
        
        // Process remaining entries
        await processBatch();
        
        this.emit('indexed', totalStats);
        resolve(totalStats);
      });
      
      stream.on('error', (err) => reject(err));
    });
  }
}

module.exports = LogTailer;
