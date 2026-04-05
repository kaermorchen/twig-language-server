import { Server, serverConfig } from './server';
import {
  createConnection,
  createServer,
  createTypeScriptProject,
  Diagnostic,
  loadTsdkByPath,
} from '@volar/language-server/node';
import { create as createCssService } from 'volar-service-css';
import { create as createEmmetService } from 'volar-service-emmet';
import { create as createHtmlService } from 'volar-service-html';
import { create as createTypeScriptServices } from 'volar-service-typescript';
import { URI } from 'vscode-uri';
import { semanticTokensPlugin } from './volar/semantic-tokens-plugin';
import { twigLanguagePlugin } from './volar/twig-language-plugin';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  serverConfig.extensionPath = params.initializationOptions?.extensionPath;

  const tsdk = loadTsdkByPath(
    params.initializationOptions.typescript.tsdk,
    params.locale,
  );
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [twigLanguagePlugin],
    })),
    [
      semanticTokensPlugin,
      // createHtmlService(),
      // createCssService(),
      // createEmmetService(),
      // ...createTypeScriptServices(tsdk.typescript),
    ],
  );
});

connection.onInitialized(server.initialized);

connection.onShutdown(server.shutdown);
