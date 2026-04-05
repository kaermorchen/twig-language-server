import {
  workspace,
  ExtensionContext,
  WorkspaceFolder,
  RelativePattern,
  Uri,
} from 'vscode';
// import {
//   LanguageClient,
//   LanguageClientOptions,
//   ServerOptions,
//   TransportKind,
// } from 'vscode-languageclient/node';
import {
  BaseLanguageClient,
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from '@volar/vscode/node';
import { logger, outputChannel } from './utils/logger';
import { join } from 'path';
import { activateAutoInsertion, createLabsInfo, getTsdk } from '@volar/vscode';
import * as serverProtocol from '@volar/language-server/protocol';

const clients = new Map<string, LanguageClient>();

export function activate(context: ExtensionContext) {
  try {
    workspace.workspaceFolders?.forEach((folder) =>
      addWorkspaceFolder(folder, context),
    );

    workspace.onDidChangeWorkspaceFolders(({ added, removed }) => {
      added.forEach((folder) => addWorkspaceFolder(folder, context));
      removed.forEach((folder) => removeWorkspaceFolder(folder));
    });

    logger.info('Twig extension activated');
  } catch (error) {
    logger.error('Failed to activate Twig extension', error);
  }
}

export async function deactivate(): Promise<void> {
  for (const client of clients.values()) {
    await client.stop();
  }
}

async function addWorkspaceFolder(
  workspaceFolder: WorkspaceFolder,
  context: ExtensionContext,
) {
  const folderPath = workspaceFolder.uri.fsPath;

  // const fileEvents = workspace.createFileSystemWatcher(
  //   new RelativePattern(workspaceFolder, '*.twig'),
  // );

  // context.subscriptions.push(fileEvents);

  if (clients.has(folderPath)) {
    return;
  }

  const serverModule = Uri.joinPath(context.extensionUri, 'out', 'server.js');
  const runOptions = { execArgv: <string[]>[] };
  const debugOptions = { execArgv: ['--nolazy', '--inspect=' + 6009] };
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: runOptions,
    },
    debug: {
      module: serverModule.fsPath,
      transport: TransportKind.ipc,
      options: debugOptions,
    },
  };

  const clientOptions: LanguageClientOptions = {
    workspaceFolder,
    outputChannel,
    documentSelector: [
      {
        // scheme: 'file',
        language: 'twig',
        // pattern: `${folderPath}/**`,
      },
    ],
    // synchronize: { fileEvents },
    initializationOptions: {
      extensionPath: context.extensionPath,
      typescript: {
        tsdk: (await getTsdk(context))!.tsdk,
      },
    },
  };

  const client = new LanguageClient(
    'twig-language-server',
    'Twig Language Server',
    serverOptions,
    clientOptions,
  );

  clients.set(folderPath, client);

  await client.start();

  activateAutoInsertion('twig', client);

  // support for https://marketplace.visualstudio.com/items?itemName=johnsoncodehk.volarjs-labs
  const labsInfo = createLabsInfo(serverProtocol);
  labsInfo.addLanguageClient(client);
  return labsInfo.extensionExports;
}

async function removeWorkspaceFolder(
  workspaceFolder: WorkspaceFolder,
): Promise<void> {
  const folderPath = workspaceFolder.uri.fsPath;
  const client = clients.get(folderPath);

  if (client) {
    clients.delete(folderPath);

    await client.stop();
  }
}
