import type {
  LanguageServicePlugin,
  LanguageServicePluginInstance,
  SemanticToken,
} from '@volar/language-service';
import { URI } from 'vscode-uri';
import { semanticTokensLegend } from '../semantic-tokens/tokens-provider';
import { parseTwig } from '../utils/parse-twig';
import { pointToPosition } from '../utils/point-to-position';
import { PreOrderCursorIterator } from '../utils/pre-order-cursor-iterator';
import type { TextDocument } from 'vscode-languageserver-textdocument';
import type { Range, CancellationToken } from '@volar/language-service';

const tokenTypes = new Map<string, number>(
  semanticTokensLegend.tokenTypes.map((v, i) => [v, i]),
);

const functionTokenType = tokenTypes.get('function')!;
const commentTokenType = tokenTypes.get('comment')!;

const resolveTokenType = (node: any) => {
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

export const semanticTokensPlugin: LanguageServicePlugin = {
  name: 'twig-semantic-tokens',
  capabilities: {
    semanticTokensProvider: {
      legend: semanticTokensLegend,
    },
  },
  create(context): LanguageServicePluginInstance {
    return {
      provideDocumentSemanticTokens(
        document: TextDocument,
        range: Range,
        legend: typeof semanticTokensLegend,
        token: CancellationToken,
      ) {
        const decoded = context.decodeEmbeddedDocumentUri(
          URI.parse(document.uri),
        );
        if (!decoded) {
          // Not an embedded document (root Twig document)
          return provideTwigSemanticTokens(document);
        }
        // Embedded documents (e.g., HTML, CSS inside Twig) пока не поддерживаем
        return undefined;
      },
    };
  },
};

async function provideTwigSemanticTokens(
  document: TextDocument,
): Promise<SemanticToken[]> {
  const content = document.getText();
  const tree = await parseTwig(content);
  const tokens: SemanticToken[] = [];
  const nodes = new PreOrderCursorIterator(tree.walk());

  for (const node of nodes) {
    const tokenType = resolveTokenType(node);
    if (tokenType === undefined) {
      continue;
    }

    const start = pointToPosition(node.startPosition);
    const lines = node.nodeText.split('\n');
    let lineNumber = start.line;
    let charNumber = start.character;

    for (const line of lines) {
      tokens.push([
        lineNumber,
        charNumber,
        line.length,
        tokenType,
        0, // modifiers
      ]);
      lineNumber++;
      charNumber = 0;
    }
  }
  // line: number,
  //     character: number,
  //     length: number,
  //     tokenTypes: number,
  //     tokenModifiers: number
  // Convert flat array to array of tuples (SemanticToken[])
  // const semanticTokens: SemanticToken[] = [];
  // for (let i = 0; i < tokens.length; i += 5) {
  //   semanticTokens.push([
  //     tokens[i],
  //     tokens[i + 1],
  //     tokens[i + 2],
  //     tokens[i + 3],
  //     tokens[i + 4],
  //   ]);
  // }

  return tokens;
}
