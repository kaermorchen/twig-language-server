import {
  CodeMapping,
  forEachEmbeddedCode,
  LanguagePlugin,
  VirtualCode,
} from '@volar/language-core';
import type { TypeScriptExtraServiceScript } from '@volar/typescript';
import type * as ts from 'typescript';
import { URI } from 'vscode-uri';
import { parseTwig } from '../utils/parse-twig';
import Parser from 'web-tree-sitter';

export const twigLanguagePlugin: LanguagePlugin<URI> = {
  getLanguageId(uri) {
    if (uri.path.endsWith('.twig') || uri.path.endsWith('.html.twig')) {
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

  constructor(public snapshot: ts.IScriptSnapshot) {
    // 1:1 mapping всего документа
    this.mappings = [
      {
        sourceOffsets: [0],
        generatedOffsets: [0],
        lengths: [snapshot.getLength()],
        data: {
          completion: true,
          format: false,
          navigation: true,
          semantic: true,
          structure: true,
          verification: true,
        },
      },
    ];
    // Парсинг Twig отложим до необходимости
    // this.tree = await parseTwig(snapshot.getText(0, snapshot.getLength()));
  }
}
