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

export const twigLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.twig')) {
      return 'twig';
    }
  },
  createVirtualCode(_uri, languageId, snapshot) {
    if (languageId === 'twig') {
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
    getExtraServiceScripts(fileName, root) {
      const scripts: TypeScriptExtraServiceScript[] = [];
      for (const code of forEachEmbeddedCode(root)) {
        // Если есть embedded JavaScript/TypeScript коды, можно добавить
        // Пока оставим пустым
      }
      return scripts;
    },
  },
};

export class TwigVirtualCode implements VirtualCode {
  id = 'root';
  languageId = 'twig';
  mappings: CodeMapping[];
  embeddedCodes: VirtualCode[] = [];
  tree?: Parser.Tree;
  private treePromise: Promise<Parser.Tree> | null = null;

  constructor(public snapshot: ts.IScriptSnapshot) {
    // 1:1 mapping всего документа
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [snapshot.getLength()],
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

    this.ensureTree();
  }

  private async ensureTree(): Promise<Parser.Tree> {
    if (this.tree) {
      return this.tree;
    }
    if (!this.treePromise) {
      this.treePromise = parseTwig(
        this.snapshot.getText(0, this.snapshot.getLength()),
      );
    }
    this.tree = await this.treePromise;
    await this.updateEmbeddedCodes();
    return this.tree;
  }

  private async updateEmbeddedCodes(): Promise<void> {
    if (!this.tree) {
      return;
    }
    const embedded: VirtualCode[] = [];
    const root = this.tree.rootNode;
    this.collectEmbeddedNodes(root, embedded);
    this.embeddedCodes = embedded;
  }

  private collectEmbeddedNodes(node: SyntaxNode, result: VirtualCode[]): void {
    if (!this.tree) {
      return;
    }

    for (const node of this.tree.rootNode.children) {
      if (node.type !== 'content') {
        result.push(
          new TwigBlockVirtualCode(
            `${node.type}_${node.startIndex}`,
            this.snapshot,
            node.startIndex,
            node.endIndex - node.startIndex,
            node.type,
          ),
        );
      }
    }
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
