import { Position } from 'vscode-languageserver';
import { Server } from '../server';
import { findNodeByPosition } from '../utils/find-element-by-position';

export async function isInsideHtmlRegion(
  server: Server,
  url: string,
  position: Position
): Promise<boolean | undefined> {
  const document = server.documentCache.getDocument(url);

  if (!document) {
    return;
  }

  const cst = await document.cst();
  const cursorNode = findNodeByPosition(cst.rootNode, position);

  if (!cursorNode) {
    return;
  }

  return cursorNode.type === 'content';
}
