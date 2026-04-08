import {
  workspace,
  ExtensionContext,
  WorkspaceFolder,
  RelativePattern,
} from 'vscode';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from 'vscode-languageclient/node';
import { logger, outputChannel } from './utils/logger';
import { join } from 'path';

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
): Promise<void> {
  const folderPath = workspaceFolder.uri.fsPath;
  const fileEvents = workspace.createFileSystemWatcher(
    new RelativePattern(workspaceFolder, '*.twig'),
  );

  context.subscriptions.push(fileEvents);

  if (clients.has(folderPath)) {
    return;
  }

  const serverModule = context.asAbsolutePath(join('out', 'server.js'));
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', `--inspect=6009`] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    workspaceFolder,
    outputChannel,
    documentSelector: [
      {
        language: 'html',
      },
    ],
    synchronize: { fileEvents },
    initializationOptions: {
      extensionPath: context.extensionPath,
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
