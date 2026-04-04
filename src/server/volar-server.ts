import {
  createConnection,
  createServer,
  createTypeScriptProject,
  loadTsdkByPath,
} from '@volar/language-server/node';
import { URI } from 'vscode-uri';
import { twigLanguagePlugin } from './volar/twig-language-plugin';
import { semanticTokensPlugin } from './volar/semantic-tokens-plugin';

const connection = createConnection();
const server = createServer(connection);

connection.listen();

connection.onInitialize((params) => {
  // Если нужен TypeScript, можно загрузить tsdk, но для Twig не требуется
  // Пока создадим проект без TypeScript, используя только языковой плагин
  const tsdk = loadTsdkByPath(
    params.initializationOptions?.typescript?.tsdk ?? '',
    params.locale,
  );
  return server.initialize(
    params,
    createTypeScriptProject(tsdk.typescript, tsdk.diagnosticMessages, () => ({
      languagePlugins: [twigLanguagePlugin],
    })),
    [semanticTokensPlugin],
  );
});

connection.onInitialized(server.initialized);
connection.onShutdown(server.shutdown);
