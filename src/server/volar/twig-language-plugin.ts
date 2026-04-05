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
      return 'twig';
    }
  },
  createVirtualCode(uri, languageId, snapshot) {
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
    // getExtraServiceScripts(fileName, root) {
    //   const scripts: TypeScriptExtraServiceScript[] = [];
    //   for (const code of forEachEmbeddedCode(root)) {
    //     // Если есть embedded JavaScript/TypeScript коды, можно добавить
    //     // Пока оставим пустым
    //   }
    //   return scripts;
    // },
  },
};

const htmlLs = html.getLanguageService();

export class TwigVirtualCode implements VirtualCode {
  id = 'root';
  languageId = 'html';
  mappings: CodeMapping[] = [];
  embeddedCodes: VirtualCode[] = [];
  htmlDocument: html.HTMLDocument;
  // tree?: Parser.Tree;
  // private treePromise: Promise<Parser.Tree> | null = null;

  constructor(public snapshot: ts.IScriptSnapshot) {
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [snapshot.getLength()],
        data: {
          completion: true,
          format: true,
          navigation: true,
          semantic: true,
          structure: true,
          verification: true,
        },
      },
    ];

    this.htmlDocument = htmlLs.parseHTMLDocument(
      html.TextDocument.create(
        '',
        'html',
        0,
        snapshot.getText(0, snapshot.getLength()),
      ),
    );

    // this.onSnapshotUpdated();

    // // 1:1 mapping всего документа
    // this.mappings = [
    //   {
    //     sourceOffsets: [0],
    //     generatedOffsets: [0],
    //     lengths: [snapshot.getLength()],
    //     data: {
    //       completion: false,
    //       format: false,
    //       navigation: false,
    //       semantic: true,
    //       structure: false,
    //       verification: false,
    //     },
    //   },
    // ];

    // this.ensureTree();
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

        // const fullMatch = node.text;
        // const content = match[1];        // " content "
        // const start = match.index;       // Начало {{
        // const contentStart = start + 2;  // Начало контента после {{

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
              sourceOffsets: [node.startIndex], // Указываем, где в ориг. файле начало
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

        // this.embeddedCodes.push(
        //   new TwigBlockVirtualCode(
        //     `${node.type}_${node.startIndex}`,
        //     this.snapshot,
        //     node.startIndex,
        //     node.endIndex - node.startIndex,
        //     node.type,
        //   ),
        // );
        // result.push(
        //   new TwigBlockVirtualCode(
        //     `${node.type}_${node.startIndex}`,
        //     this.snapshot,
        //     node.startIndex,
        //     node.endIndex - node.startIndex,
        //     node.type,
        //   ),
        // );
      }
    }

    // Сохраняем маскированный код для HTML-сервиса
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

  // private async ensureTree(): Promise<Parser.Tree> {
  //   if (this.tree) {
  //     return this.tree;
  //   }
  //   if (!this.treePromise) {
  //     this.treePromise = parseTwig(
  //       this.snapshot.getText(0, this.snapshot.getLength()),
  //     );
  //   }
  //   this.tree = await this.treePromise;
  //   await this.updateEmbeddedCodes();
  //   return this.tree;
  // }

  // private async updateEmbeddedCodes(): Promise<void> {
  //   if (!this.tree) {
  //     return;
  //   }
  //   const embedded: VirtualCode[] = [];
  //   const root = this.tree.rootNode;
  //   this.collectEmbeddedNodes(root, embedded);
  //   this.embeddedCodes = embedded;
  // }

  // private collectEmbeddedNodes(node: SyntaxNode, result: VirtualCode[]): void {
  //   if (!this.tree) {
  //     return;
  //   }

  //   for (const node of this.tree.rootNode.children) {
  //     if (node.type !== 'content') {
  //       result.push(
  //         new TwigBlockVirtualCode(
  //           `${node.type}_${node.startIndex}`,
  //           this.snapshot,
  //           node.startIndex,
  //           node.endIndex - node.startIndex,
  //           node.type,
  //         ),
  //       );
  //     }
  //   }
  // }
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
