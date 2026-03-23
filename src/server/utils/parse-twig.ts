import { readFile } from 'fs/promises';
import { join } from 'path';
import Parser from 'web-tree-sitter';
import { serverConfig } from '../server';

let parser: Promise<Parser>;

export async function parseTwig(content: string): Promise<Parser.Tree> {
  if (!parser) {
    parser = new Promise(async (resolve, reject) => {
      try {
        await Parser.init();
        const parser = new Parser();
        const wasm = await readFile(
          join(serverConfig.extensionPath, 'out', 'tree-sitter-twig.wasm'),
        );
        const lang = await Parser.Language.load(wasm);

        parser.setLanguage(lang);

        resolve(parser);
      } catch (error) {
        reject(error);
      }
    });
  }

  return parser.then((parser) => parser.parse(content));
}
