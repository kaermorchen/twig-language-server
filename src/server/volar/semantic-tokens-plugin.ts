import type {
  LanguageServiceContext,
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

export const resolveTokenType = (node: any) => {
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
  create(context: LanguageServiceContext): LanguageServicePluginInstance {
    return {
      provideDocumentSemanticTokens(
        document: TextDocument,
        range: Range,
        legend: typeof semanticTokensLegend,
        token: CancellationToken,
      ) {
        return provideTwigSemanticTokens(document);
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

    tokens.push([start.line, start.character, lines[0].length, tokenType, 0]);

    for (let i = 1; i < lines.length; i++) {
      tokens.push([start.line + i, 0, lines[i].length, tokenType, 0]);
    }
  }

  return tokens;
}
