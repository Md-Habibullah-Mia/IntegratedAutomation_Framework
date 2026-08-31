type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

class Logger {
  private write(level: Level, message: string, meta?: Record<string, unknown>) {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] [${level}] ${message}`;
    // eslint-disable-next-line no-console
    console.log(meta ? `${line} ${JSON.stringify(meta)}` : line);
  }

  info(message: string, meta?: Record<string, unknown>) {
    this.write('INFO', message, meta);
  }
  warn(message: string, meta?: Record<string, unknown>) {
    this.write('WARN', message, meta);
  }
  error(message: string, meta?: Record<string, unknown>) {
    this.write('ERROR', message, meta);
  }
  debug(message: string, meta?: Record<string, unknown>) {
    if (process.env.DEBUG === 'true') this.write('DEBUG', message, meta);
  }
}

export const logger = new Logger();
