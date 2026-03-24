import { URI } from 'vscode-uri';
import readDir from './utils/read-dir';
import { parseTwig } from './utils/parse-twig';
import { readFile } from 'fs/promises';
import { DocumentUri, WorkspaceFolder } from 'vscode-languageserver';
import { fsPathToDocumentUri } from './utils/fs-path-to-document-uri';
import Parser from 'web-tree-sitter';

export class Document {
  documentUri: string;
  text: string | undefined;
  cstCache: Parser.Tree | undefined;

  constructor(documentUri: DocumentUri) {
    this.documentUri = documentUri;
  }

  async setText(text: string) {
    this.cstCache = undefined;
    this.text = text;
  }

  async getText(): Promise<string> {
    if (this.text) {
      return this.text;
    }

    this.text = await readFile(this.documentUri, 'utf-8');

    return this.text;
  }

  async cst(): Promise<Parser.Tree> {
    if (this.cstCache) {
      return this.cstCache;
    }

    const text = await this.getText();

    this.cstCache = await parseTwig(text);

    return this.cstCache;
  }
}

export class DocumentCache {
  workspaceFolder!: WorkspaceFolder;
  documents: Map<DocumentUri, Document> = new Map();

  constructor(workspaceFolder: WorkspaceFolder) {
    this.workspaceFolder = workspaceFolder;
  }

  async getDocument(documentUri: DocumentUri): Promise<Document | undefined> {
    if (this.documents.has(documentUri)) {
      return this.documents.get(documentUri);
    }

    const doc = new Document(documentUri);

    this.documents.set(documentUri, doc);

    return doc;
  }
}
