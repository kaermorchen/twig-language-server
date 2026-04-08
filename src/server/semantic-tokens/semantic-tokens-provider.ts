import {
  SemanticTokensParams,
  SemanticTokens,
  SemanticTokensBuilder,
} from 'vscode-languageserver';
import { Server } from '../server';
import { PreOrderCursorIterator } from '../utils/pre-order-cursor-iterator';
import { pointToPosition } from '../utils/point-to-position';
import { semanticTokensLegend } from './tokens-provider';
import { TreeCursor } from 'web-tree-sitter';

const tokenTypes = new Map<string, number>(
  semanticTokensLegend.tokenTypes.map((v, i) => [v, i]),
);

const functionTokenType = tokenTypes.get('function')!;
const commentTokenType = tokenTypes.get('comment')!;

const resolveTokenType = (node: TreeCursor) => {
  if (
    node.nodeType === 'property' &&
    node.currentNode.parent!.nextSibling?.type === 'arguments'
  ) {
    return functionTokenType;
  }

  if (node.nodeType === 'inline_comment') {
    return commentTokenType;
  }

  return tokenTypes.get(node.nodeType);
};

export class SemanticTokensProvider {
  server: Server;

  constructor(server: Server) {
    this.server = server;

    this.server.connection.languages.semanticTokens.on(
      this.serverRequestHandler.bind(this),
    );
  }

  async serverRequestHandler(params: SemanticTokensParams) {
    const semanticTokens: SemanticTokens = { data: [] };
    const uri = params.textDocument.uri;
    const document = await this.server.documentCache.getDocument(uri);

    if (!document) {
      return semanticTokens;
    }

    const cst = await document.cst();
    const tokensBuilder = new SemanticTokensBuilder();
    const nodes = new PreOrderCursorIterator(cst.walk());

    for (const node of nodes) {
      const tokenType = resolveTokenType(node);

      if (tokenType === undefined) {
        continue;
      }

      const start = pointToPosition(node.startPosition);
      const lines = node.nodeText.split('\n');

      tokensBuilder.push(
        start.line,
        start.character,
        lines[0].length,
        tokenType,
        0,
      );

      for (let i = 1; i < lines.length; i++) {
        tokensBuilder.push(start.line + i, 0, lines[i].length, tokenType, 0);
      }
    }

    return tokensBuilder.build();
  }
}
