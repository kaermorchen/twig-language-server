import { readFile } from 'fs/promises';
import { join } from 'path';
import Parser from 'web-tree-sitter';
import { serverConfig } from '../server';

let parser: Parser;

export async function parseTwig(content: string): Promise<Parser.Tree> {
  if (!parser) {
    await Parser.init();
    parser = new Parser();
    parser.setLanguage(
      await Parser.Language.load(
        await readFile(
          join(serverConfig.extensionPath, 'out', 'tree-sitter-twig.wasm'),
        ),
      ),
    );
  }

  return parser.parse(content);
}
