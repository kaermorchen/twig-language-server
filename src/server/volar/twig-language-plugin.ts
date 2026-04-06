import {
  CodeMapping,
  forEachEmbeddedCode,
  LanguagePlugin,
  Mapping,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptExtraServiceScript } from '@volar/typescript';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { parseTwig } from '../utils/parse-twig';
import Parser from 'web-tree-sitter';
import type { SyntaxNode } from 'web-tree-sitter';
import { PreOrderCursorIterator } from '../utils/pre-order-cursor-iterator';
import { resolveTokenType } from './semantic-tokens-plugin';
import * as html from 'vscode-html-languageservice';

export const twigLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.twig')) {
      return 'html';
    }
  },
  createVirtualCode(uri, languageId, snapshot) {
    if (uri.path.endsWith('.twig')) {
      return new TwigVirtualCode(snapshot);
    }
  },
  typescript: {
    extraFileExtensions: [
      {
        extension: 'twig',
        isMixedContent: true,
        scriptKind: 7 satisfies ts.ScriptKind.Deferred,
      },
    ],
    getServiceScript() {
      return undefined;
    },
  },
};

const htmlLs = html.getLanguageService();

export class TwigVirtualCode implements VirtualCode {
  id = 'root';
  languageId = 'html';
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];

  constructor(public snapshot: ts.IScriptSnapshot) {
    this.onSnapshotUpdated();
  }

  private async onSnapshotUpdated() {
    const text = this.snapshot.getText(0, this.snapshot.getLength());
    this.embeddedCodes = [];
    const tree = await parseTwig(text);
    let maskedHtml = '';

    for (const node of tree.rootNode.children) {
      if (node.type === 'content') {
        maskedHtml += node.text;
      } else {
        maskedHtml += ' '.repeat(node.text.length);

        this.embeddedCodes.push({
          id: 'twig_' + node.startIndex,
          languageId: 'typescript',
          snapshot: {
            getText: (s, e) => node.text.substring(s, e),
            getLength: () => node.text.length,
            getChangeRange: () => undefined,
          },
          mappings: [
            {
              sourceOffsets: [node.startIndex],
              generatedOffsets: [0],
              lengths: [node.text.length],
              data: {
                verification: true,
                completion: true,
                semantic: true,
                navigation: true,
                structure: true,
                format: true,
              },
            },
          ],
          embeddedCodes: [],
        });
      }
    }

    this.snapshot = {
      getText: (start, end) => maskedHtml.substring(start, end),
      getLength: () => maskedHtml.length,
      getChangeRange: () => undefined,
    };

    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [text.length],
        data: {
          verification: true,
          completion: true,
          semantic: true,
          navigation: true,
          structure: true,
          format: true,
        },
      },
    ];
  }
}

class TwigBlockVirtualCode implements VirtualCode {
  languageId = 'twig';
  mappings: CodeMapping[];
  snapshot: ts.IScriptSnapshot;
  embeddedCodes: VirtualCode[] = [];

  constructor(
    public id: string,
    snapshot: ts.IScriptSnapshot,
    private startOffset: number,
    private length: number,
    private blockType: string,
  ) {
    this.snapshot = snapshot;
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [this.startOffset],
        lengths: [this.length],
        data: {
          completion: false,
          format: false,
          navigation: false,
          semantic: true,
          structure: false,
          verification: false,
        },
      },
    ];
  }
  associatedScriptMappings?: Map<unknown, CodeMapping[]> | undefined;
  linkedCodeMappings?: Mapping<unknown>[] | undefined;
}
