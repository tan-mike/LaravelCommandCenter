const fs = require('fs');
const crypto = require('crypto');

class LogParser {
  /**
   * Parse Laravel log file and extract errors
   * @param {string} logContent - Raw log file content
   * @returns {Array} Parsed log entries
   */
  static parse(logContent) {
    const entries = [];
    const lines = logContent.split('\n');
    let currentEntry = null;

    for (const line of lines) {
      // Check if line starts a new log entry
      if (this.isLogStart(line)) {
        // Save previous entry if exists
        if (currentEntry) {
          entries.push(this.finalizeEntry(currentEntry));
        }

        // Start new entry
        currentEntry = this.parseLogLine(line);
      } else if (currentEntry) {
        // Continuation of previous entry (stack trace, etc.)
        currentEntry.rawLines.push(line);
      }
    }

    // Don't forget the last entry
    if (currentEntry) {
      entries.push(this.finalizeEntry(currentEntry));
    }

    return entries;
  }

  /**
   * Check if line starts a new log entry
   */
  static isLogStart(line) {
    // Laravel log format: [2023-12-11 10:30:45] local.ERROR: ...
    return /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\]/.test(line);
  }

  /**
   * Parse a log line to extract metadata
   */
  static parseLogLine(line) {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (\w+)\.(\w+): (.+)$/);
    
    if (match) {
      return {
        timestamp: new Date(match[1]),
        environment: match[2],
        level: match[3],
        message: match[4],
        rawLines: [line]
      };
    }

    // Fallback for non-standard format
    return {
      timestamp: new Date(),
      environment: 'unknown',
      level: 'INFO',
      message: line,
      rawLines: [line]
    };
  }

  /**
   * Finalize entry by extracting stack trace and exception info
   */
  static finalizeEntry(entry) {
    const fullText = entry.rawLines.join('\n');
    
    // Extract exception class
    const exceptionMatch = fullText.match(/^([A-Za-z\\]+Exception|Error):/m);
    entry.exception = exceptionMatch ? exceptionMatch[1] : null;

    // Extract stack trace
    entry.stackTrace = this.extractStackTrace(fullText);

    // Generate fingerprint for grouping
    entry.fingerprint = this.generateFingerprint(entry);

    // Get first line of message as title
    entry.title = this.extractTitle(entry.message, entry.exception);

    return entry;
  }

  /**
   * Extract stack trace from log entry
   */
  static extractStackTrace(text) {
    const stackTrace = [];
    const stackPattern = /#\d+ (.+?)\((\d+)\): (.+)/g;
    let match;

    while ((match = stackPattern.exec(text)) !== null) {
      stackTrace.push({
        file: match[1],
        line: parseInt(match[2]),
        call: match[3]
      });
    }

    return stackTrace;
  }

  /**
   * Generate fingerprint for error grouping
   * Normalizes file paths and line numbers to group similar errors
   */
  static generateFingerprint(entry) {
    // Use exception type + first stack frame (without line number)
    let fingerprintBase = entry.exception || 'unknown';

    if (entry.stackTrace.length > 0) {
      const firstFrame = entry.stackTrace[0];
      // Remove line number and normalize path
      const normalizedFile = firstFrame.file
        .replace(/\\/g, '/')
        .replace(/^.*\/(app|vendor)\//, '$1/');
      fingerprintBase += ':' + normalizedFile + ':' + firstFrame.call;
    } else {
      // Fallback to message (first 100 chars)
      fingerprintBase += ':' + entry.message.substring(0, 100);
    }

    // Create hash
    return crypto.createHash('md5').update(fingerprintBase).digest('hex');
  }

  /**
   * Extract title from message
   */
  static extractTitle(message, exception) {
    if (exception) {
      // Extract message after exception class
      const match = message.match(/^[A-Za-z\\]+(?:Exception|Error): (.+?)(?:\n|$)/);
      if (match) {
        return match[1].substring(0, 200);
      }
    }

    // Return first line of message
    return message.split('\n')[0].substring(0, 200);
  }

  /**
   * Parse single line for real-time tailing
   */
  static parseLine(line, previousEntry = null) {
    if (this.isLogStart(line)) {
      // New entry
      return {
        isNew: true,
        entry: this.parseLogLine(line)
      };
    } else if (previousEntry) {
      // Continuation of previous entry
      previousEntry.rawLines.push(line);
      return {
        isNew: false,
        entry: previousEntry
      };
    }

    return null;
  }
}

module.exports = LogParser;
