import ts from "typescript"
import { createAst } from "./createSourceFile"

export interface SourceLineCol {
  fileName: string
  lineNumber: number
  columnNumber: number
}

export interface Attribute {
  [name: string]: string
}

export const startOfJsxNode = (code: string, source: SourceLineCol) =>
  startOfJsxIdentifier(code, source)! - 1

export function startOfJsxIdentifier(code: string, source: SourceLineCol) {
  const sourceLines = code.split("\n")
  if (source.lineNumber > 0 && source.lineNumber < sourceLines.length) {
    const lineIndex = source.lineNumber - 1
    let start = 0
    for (let i = 0; i < lineIndex; ++i) {
      const line = sourceLines[i]
      start += line.length + 1
    }
    start += source.columnNumber - 1
    // Here i intentionaly add 1 to the start variable to move from start of JSXElement
    // to start of StringLiteral, because of discovered bug in typescript AST
    start += 1

    return start
  }

  return null
}

export function astFindStart(code: string, start: number) {
  const ast = createAst(code)
  const callback = (node: ts.Node) => {
    const nodeStart = node.pos
    if (nodeStart <= start && start <= node.end) {
      if (nodeStart === start) {
        // node.kind == ts.SyntaxKind.JsxElement
        return node
      }
      return ts.forEachChild<ts.Node>(node, callback)
    }

    return null
  }
  if (ast) {
    const found = ts.forEachChild(ast, callback)
    return found
  }

  return null
}

export const codeStart = (code: string, source: SourceLineCol) => {
  const identifierStart = startOfJsxIdentifier(code, source)
  if (!identifierStart) return null
  const identifierNode = astFindStart(code, identifierStart)
  if (!identifierNode) return null
  // return pos of parent if element is self closing element, otherwise return position of grandparent
  if (ts.isJsxSelfClosingElement(identifierNode.parent))
    return identifierNode.parent.pos
  if (ts.isJsxOpeningElement(identifierNode.parent))
    return identifierNode.parent.parent.pos
}

export function astFindSource(code: string, source: SourceLineCol) {
  const start = codeStart(code, source)
  if (start) {
    const found = astFindStart(code, start)
    return found
    //sourceLines.splice(lineIndex, 0, sourceLine);
    //const newContent = sourceLines.join('\n');
    //return newContent;
  }

  return null
}

export const jsxElementGetAttributes = (node: ts.JsxOpeningLikeElement) => {
  const attributes: Array<Attribute> = []

  node.attributes.forEachChild((a: unknown) => {
    const attribute = a as ts.JsxAttribute
    const { initializer } = attribute

    if (!initializer) return

    if (initializer && ts.isStringLiteral(initializer)) {
      attributes.push({
        [attribute.name.text]: initializer.text,
      })
    } else if (initializer && ts.isJsxExpression(initializer)) {
      attributes.push({
        [attribute.name.text]:
          //@ts-ignore
          initializer.expression?.escapedText,
      })
    }
  })
  return attributes
}
