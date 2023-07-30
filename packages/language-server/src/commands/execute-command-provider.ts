import { ExecuteCommandParams } from 'vscode-languageserver';
import { Server } from '../server';
import { isInsideHtmlRegion } from './is-inside-html-region';

const commands = new Map([
  ['twig-language-server.is-inside-html-region', isInsideHtmlRegion],
]);

export class ExecuteCommandProvider {
  server: Server;

  constructor(server: Server) {
    this.server = server;

    this.server.connection.onExecuteCommand(this.onExecuteCommand.bind(this));
  }

  onExecuteCommand(params: ExecuteCommandParams) {
    const command = commands.get(params.command);

    if (typeof command !== 'function') {
      return;
    }

    let args = [this.server];

    if (params.arguments) {
      args = args.concat(params.arguments);
    }

    // @ts-expect-error
    return command.apply(null, args);
  }
}
