import { window } from 'vscode';

export const outputChannel = window.createOutputChannel('Twig');

class Logger {
  info(...args: unknown[]): void {
    const prefix = getPrefixWithTimestamp('INFO');

    console.info(prefix, ...args);
    outputChannel.appendLine(`${prefix} ${args.join(' ')}`);
  }

  warn(...args: unknown[]): void {
    const prefix = getPrefixWithTimestamp('WARN');

    console.warn(prefix, ...args);
    outputChannel.appendLine(`${prefix} ${args.join(' ')}`);
  }

  error(...args: unknown[]): void {
    const prefix = getPrefixWithTimestamp('ERROR');

    console.error(prefix, ...args);
    outputChannel.appendLine(`${prefix} ${args.join(' ')}`);
  }

  openOutput(): void {
    outputChannel.show();
  }
}

export const logger = new Logger();

function getPrefixWithTimestamp(loggerType: 'INFO' | 'WARN' | 'ERROR'): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const milliseconds = String(now.getMilliseconds()).padStart(3, '0');
  const timestamp = `${hours}:${minutes}:${seconds}:${milliseconds}`;

  return `[${loggerType} ${timestamp}]`;
}
