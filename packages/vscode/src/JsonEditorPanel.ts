"use strict";

import * as path from "path";
import * as vscode from "vscode";
import * as parse5 from "parse5";
import * as fs from 'fs';
import * as prettierSvelte from 'prettier-plugin-svelte';
import * as parser from 'prettier-plugin-svelte';
import * as printAstToDoc from 'prettier/src/main/ast-to-doc'
import * as prettierCore from 'prettier/src/main/core'
import * as prettierOpts from 'prettier/src/main/options'
import * as prettierMulti from 'prettier/src/main/multiparser'
import * as FastPath from 'prettier/src/common/fast-path'
import * as prettierCss from 'prettier/src/language-css'
import * as prettierJs from 'prettier/src/language-js'
import * as prettierHtml from 'prettier/src/language-html'
import * as prettierDoc from 'prettier/src/document/doc-printer'

export class JsonEditorPanel {
  public static currentPanel: JsonEditorPanel | undefined;
  scriptTextSave : Array<any> = [];
  scriptNodeSave : any = {};
  private static readonly viewType: string = "jsonEditor";
  //private static readonly extensionPrefix: string = 'vscode-json-editor';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionPath: string;
  private _disposables: vscode.Disposable[] = [];
  private _currentEditor: vscode.TextEditor;

  private constructor(
    extensionPath: string,
    column: vscode.ViewColumn,
    theme: string
  ) {
    this._extensionPath = extensionPath;
    this._currentEditor = vscode.window.activeTextEditor;
    this._panel = vscode.window.createWebviewPanel(
      JsonEditorPanel.viewType,
      "JSON Tree Editor",
      column,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(this._extensionPath, "jsoneditor")),
        ],
      }
    );

    this._panel.webview.html = this.getHtmlForWebview(
      this._extensionPath,
      theme
    );

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage((message) => {
      if (this._currentEditor) {
        this._currentEditor.edit((editBuilder) => {
          const range: vscode.Range = new vscode.Range(
            this._currentEditor.document.positionAt(0),
            this._currentEditor.document.positionAt(
              this._currentEditor.document.getText().length
            )
          );
          let html = parse5.serialize(JSON.parse(message.json));
          //TODO dynamicky: Match every script using regex, this will return an array
          // cycle the matched array and paste the text between them (index based)
          html = html.replace(/<script[^>]*>.*?<\/script>/g,'<script>'+this.scriptTextSave[0]+'</script>')
          editBuilder.replace(range, html);
        });
      }
    });

    vscode.window.onDidChangeActiveTextEditor(() =>
      this.onActiveEditorChanged()
    );
    vscode.workspace.onDidSaveTextDocument(() => this.onDocumentChanged());
    vscode.window.onDidChangeActiveColorTheme(() =>
      this.colorThemeKindChange(theme)
    );

    this.colorThemeKindChange(theme);
    this.onActiveEditorChanged();
  }

  // tslint:disable-next-line:function-name
  public static CreateOrShow(extensionPath: string): void {
    const column = vscode.ViewColumn.Beside;
    //const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(this.extensionPrefix);
    //const theme: string = config.get(configurationSettings.theme);

    const theme = {
      [vscode.ColorThemeKind.Light]: "light",
      [vscode.ColorThemeKind.Dark]: "dark",
      [vscode.ColorThemeKind.HighContrast]: "dark",
    }[vscode.window.activeColorTheme.kind];

    if (JsonEditorPanel.currentPanel) {
      JsonEditorPanel.currentPanel._panel.reveal(column);
    } else {
      JsonEditorPanel.currentPanel = new JsonEditorPanel(
        extensionPath,
        column,
        theme
      );
    }
  }

  public dispose(): void {
    JsonEditorPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private filterNodes(documentFragment: any) {
    const removeParentNode = (obj) => {
      Object.keys(obj).forEach(key => 
        (key === 'parentNode') && delete obj[key] || 
        (obj[key] && typeof obj[key] === 'object') && removeParentNode(obj[key])
        );
        return obj;
    }
    delete documentFragment.nodeName;
    removeParentNode(documentFragment.childNodes);
    this.scriptNodeSave = documentFragment.childNodes.filter(function( obj ) {
      return obj.tagName === 'script';
    });
    this.scriptNodeSave.map(node => this.scriptTextSave.push(node.childNodes[0].value))
    documentFragment.childNodes[0].childNodes[0].value = '';
    //documentFragment.childNodes[0].childNodes
    /*documentFragment.childNodes = documentFragment.childNodes.filter(function( obj ) {
      return obj.tagName !== 'script';
    }); */
    //TODO need this to be dynamic
    //const folderPath = vscode.workspace.rootPath+'/src/pages/';
    //this.createFiles(folderPath, 'script.txt', JSON.stringify(this.scriptTextSave));
    
    return documentFragment;
  }

  private doFormat(input) {
    //let ast = parser.parsers.svelte.parse(input);
    //ast.tokens = []
    const locStart = parser.parsers.svelte.locStart;
    const locEnd = parser.parsers.svelte.locEnd;

    let options = prettierOpts.normalize({
      tabWidth: 2,
      parser: 'svelte' as any,
      "svelteSortOrder": "scripts-styles-markup",
      plugins: [prettierCss, prettierJs, prettierHtml, prettierSvelte],
      "svelteStrictMode": false,
      "svelteBracketNewLine": false,
      "svelteAllowShorthand": true,
      "originalText": input,
      locStart,
      locEnd
    })
    
    const sveltePrint = parser.printers['svelte-ast'].print
    //const svelteEmbed = parser.printers['svelte-ast'].embed
    function printFn(fastPath) {
      const current = fastPath.getValue()

      if (current.isJS) {
        return prettierMulti.printSubtree(fastPath, sveltePrint, options, printAstToDoc)
      }
      switch (current.type) {
        case 'Script':
        case 'Style':
          return prettierMulti.printSubtree(fastPath, sveltePrint, options, printAstToDoc)
      }

      return sveltePrint(fastPath, options, printFn)
    }

    try {
      let parsed = prettierCore.parse(input, options, true)
      parsed.ast.tokens = []//pretier-svelte isASTNode() needs this
      
      options.originalText = parsed.text

      let doc = sveltePrint(new FastPath(parsed.ast), options, printFn)
      let formatted = prettierDoc.printDocToString(doc, options)
      console.log('formated AST 1', formatted)
      /*
      formatted = prettierCore.formatAST(ast, options)
      //let formatted = prettierCore.printToDoc(input, options)
      //let formatted = prettier.format(input, options)
      console.log('formated AST 2', formatted)*/
    } catch (e) {
      console.error('format failed', e)
    }
  }

  private createFiles(path: any, fileName: string, data: any) {
    fs.writeFile(path+'/'+fileName, data, err => {
      if (err) {
        return console.log(err);
      }
      console.log('Success');
    });
   }

  private getJson(): string {
    let json: string = "";
    let documentFragment: any = "";
    if (this._currentEditor) {
      json = this._currentEditor.document.getText();
      this.doFormat(json);
      //documentFragment = parse5.parseFragment(json);
      //json = this.filterNodes(documentFragment);
    }
    json = JSON.stringify(json);
    return json;
  }

  private colorThemeKindChange(theme: string): void {
    const themenew = {
      [vscode.ColorThemeKind.Light]: "light",
      [vscode.ColorThemeKind.Dark]: "dark",
      [vscode.ColorThemeKind.HighContrast]: "dark",
    }[vscode.window.activeColorTheme.kind];

    if (themenew != theme) {
      vscode.window.showInformationMessage(
        "Theme type change detected. Please close and reopen extension."
      );
    }
  }

  private onActiveEditorChanged(): void {
    if (vscode.window.activeTextEditor) {
      this._currentEditor = vscode.window.activeTextEditor;
      const json: string = this.getJson();
      this._panel.webview.postMessage({ json: json });
    }
  }

  private onDocumentChanged(): void {
    const json: string = this.getJson();
    this._panel.webview.postMessage({ json: json });
  }

  private getHtmlForWebview(extensionPath: string, theme: string): string {
    const mainScriptPathOnDisk = vscode.Uri.file(
      path.join(extensionPath, "jsoneditor", "main.js")
    );
    const mainScriptUri = mainScriptPathOnDisk.with({
      scheme: "vscode-resource",
    });
    const scriptPathOnDisk = vscode.Uri.file(
      path.join(extensionPath, "jsoneditor", "jsoneditor.min.js")
    );
    const scriptUri = scriptPathOnDisk.with({ scheme: "vscode-resource" });

    const cssPathOnDisk = vscode.Uri.file(
      path.join(extensionPath, "jsoneditor", "jsoneditor.min.css")
    );
    const cssUri = cssPathOnDisk.with({ scheme: "vscode-resource" });

    const cssDarkPathOnDisk = vscode.Uri.file(
      path.join(extensionPath, "jsoneditor", "jsoneditor.dark.min.css")
    );
    const cssDarkUri = cssDarkPathOnDisk.with({ scheme: "vscode-resource" });
    const darkTheme: string =
      theme === "dark"
        ? `<link href="${cssDarkUri}" rel="stylesheet" type="text/css">`
        : "";

    return `
        <!DOCTYPE HTML>
        <html>
        <head>
            <!-- when using the mode "code", it's important to specify charset utf-8 -->
            <meta http-equiv="Content-Type" content="text/html;charset=utf-8">

            <link href="${cssUri}" rel="stylesheet" type="text/css">
            ${darkTheme}
            <script src="${scriptUri}"></script>
        </head>
        <body>
            <div id="jsoneditor"></div>

            <script src="${mainScriptUri}"></script>
        </body>
        </html>
        `;
  }
}

