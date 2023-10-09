import {
  Connection,
  Definition,
  DefinitionParams,
  DocumentUri,
  Range,
} from 'vscode-languageserver';
import { Server } from '../server';
import { SyntaxNode } from 'web-tree-sitter';
import {
  templateUsingFunctions,
  templateUsingStatements,
} from '../constants/template-usage';
import { getStringNodeValue } from '../utils/node';
import { TemplatePathMapping } from '../utils/symfony/twigConfig';
import { documentUriToFsPath } from '../utils/document-uri-to-fs-path';
import { fileStat } from '../utils/files/fileStat';
import * as path from 'path';
import { fsPathToDocumentUri } from '../utils/fs-path-to-document-uri';
import { findNodeByPosition } from '../utils/find-element-by-position';

export type onDefinitionHandlerReturn = ReturnType<
  Parameters<Connection['onDefinition']>[0]
>;

const isFunctionCall = (
  node: SyntaxNode | null,
  functionName: string
): boolean => {
  return (
    !!node &&
    node.type === 'call_expression' &&
    node.childForFieldName('name')?.text === functionName
  );
};

const isPathInsideTemplateEmbedding = (node: SyntaxNode): boolean => {
  if (node.type !== 'string' || !node.parent) {
    return false;
  }

  const isInsideStatement = templateUsingStatements.includes(node.parent.type);

  if (isInsideStatement) {
    return true;
  }

  const isInsideFunctionCall =
    node.parent?.type === 'arguments' &&
    templateUsingFunctions.some((func) =>
      isFunctionCall(node.parent!.parent, func)
    );

  return isInsideFunctionCall;
};

export class DefinitionProvider {
  server: Server;

  templateMappings: TemplatePathMapping[] = [];

  constructor(server: Server) {
    this.server = server;

    this.server.connection.onDefinition(this.onDefinition.bind(this));
  }

  async onDefinition(
    params: DefinitionParams
  ): Promise<Definition | undefined> {
    const document = this.server.documentCache.getDocument(params.textDocument.uri);

    if (!document) {
      return;
    }

    const cst = await document.cst();

    const cursorNode = findNodeByPosition(
      cst.rootNode,
      params.position
    );

    if (!cursorNode) {
      return;
    }

    if (isPathInsideTemplateEmbedding(cursorNode)) {
      const templateUri = await this.resolveTemplateUri(
        getStringNodeValue(cursorNode)
      );

      if (!templateUri) return;

      return this.resolveTemplateDefinition(templateUri);
    }
  }

  async resolveTemplateUri(
    includeArgument: string
  ): Promise<DocumentUri | undefined> {
    const workspaceFolderDirectory = documentUriToFsPath(
      this.server.workspaceFolder.uri
    );

    for (const { namespace, directory } of this.templateMappings) {
      if (!includeArgument.startsWith(namespace)) {
        continue;
      }

      const includePath =
        namespace === ''
          ? path.join(directory, includeArgument)
          : includeArgument.replace(namespace, directory);

      const pathToTwig = path.resolve(workspaceFolderDirectory, includePath);

      const stats = await fileStat(pathToTwig);
      if (stats) {
        return fsPathToDocumentUri(pathToTwig);
      }
    }

    return undefined;
  }

  resolveTemplateDefinition(templatePath: string): Definition | undefined {
    const document = this.server.documentCache.getDocument(templatePath);

    if (!document) {
      return;
    }

    return {
      uri: fsPathToDocumentUri(document.filePath),
      range: Range.create(0, 0, 0, 0),
    };
  }
}
